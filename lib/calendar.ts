import "server-only";
import { Prisma, type Locale } from "@prisma/client";
import { prisma } from "@/lib/db";
import { activeAssignmentWhere } from "@/lib/member";
import { getTenantLocations } from "@/lib/locations";
import { DEFAULT_TIMEZONE } from "@/lib/datetime";
import { dayKeyInTz } from "@/lib/metrics/definitions";
import { zonedInputToDate } from "@/lib/tz";
import { targetSummaryFromItem } from "@/lib/exercise-params";
import {
  addDaysToDayKey,
  carryOverWeekdayPlan,
  isValidMonthKey,
  monthGridDayKeys,
  parseWeekdayPlan,
  plannedDayIdsOnDate,
  plannedDayStatuses,
  weekStartKeyOfDayKey,
  type DayRef,
  type PlannedDayStatus,
  type WeekdayPlan,
} from "@/lib/calendar-plan";

/**
 * Server-assemblage van de ledenagenda (/member/agenda): maandraster met
 * geplande schema-dagen (weekdagplanning), gedane trainingen, groepsles-
 * aanmeldingen en de gemist-afleiding. Patroon lib/member-stats.ts: base
 * `prisma` + expliciete `tenantId` in élke where (RLS is de backstop).
 *
 * Alle dag-bucketing gebeurt in de tijdzone van het lid (thuis- of
 * defaultvestiging, `getMemberCalendarTimezone`) — nooit servertijd. De pure
 * regels (statusafleiding, carry-over) wonen in lib/calendar-plan.ts.
 */

// ---------- Tijdzone van het lid ----------

/**
 * Tijdzone voor agenda-bucketing: thuisvestiging → defaultvestiging → vangnet.
 * Bewust NIET `resolveActiveLocationId`: die leest de locatie-cookie, en de
 * agenda (en straks de cookie-loze ICS-feed) hoort een stabiele klok te hebben
 * die niet meeschuift met de vestiging waar het lid toevallig incheckte.
 */
export async function getMemberCalendarTimezone(
  memberId: string,
  tenantId: string
): Promise<string> {
  const me = await prisma.user.findFirst({
    where: { id: memberId, tenantId },
    select: { homeLocationId: true },
  });
  const locations = await getTenantLocations(tenantId); // default eerst, gecachet
  const home = me?.homeLocationId
    ? locations.find((l) => l.id === me.homeLocationId)
    : undefined;
  return home?.timezone ?? locations[0]?.timezone ?? DEFAULT_TIMEZONE;
}

// ---------- Geserialiseerde rijen (geen Prisma-objecten richting UI) ----------

export type AgendaPlannedRow = {
  dayId: string;
  dayName: string;
  status: PlannedDayStatus;
  /** Oefening + type-bewuste doel-samenvatting ("4 × 10 @ 70 kg"). */
  items: { name: string; summary: string }[];
};

export type AgendaSessionRow = {
  id: string;
  /** Naam van de getrainde schema-dag; null = vrije/onbekende training. */
  dayName: string | null;
  startIso: string;
  durationMin: number | null;
  mood: string | null;
};

export type AgendaClassRow = {
  id: string;
  title: string;
  startIso: string;
  endIso: string;
  /** Tijdzone van de vestiging — lestijden altijd in de venue-klok tonen. */
  timezone: string;
  venueName: string | null;
  room: string | null;
  status: "ENROLLED" | "WAITLISTED" | "ATTENDED" | "NO_SHOW";
  cancelled: boolean;
};

export type AgendaDay = {
  dayKey: string;
  planned: AgendaPlannedRow[];
  sessions: AgendaSessionRow[];
  classes: AgendaClassRow[];
};

export type AgendaMonth = {
  monthKey: string;
  timeZone: string;
  todayKey: string;
  /** Alle rasterdagen (ma vóór de 1e t/m zo na de laatste), op volgorde. */
  days: AgendaDay[];
};

// ---------- Maand-assemblage ----------

type PlannedAssignment = {
  plan: WeekdayPlan;
  windowStartKey: string;
  windowEndKey: string | null;
  dayMeta: Map<string, { name: string; items: { name: string; summary: string }[] }>;
};

/**
 * Venstergrenzen van een toewijzing als dayKeys. Start: startDate → publishedAt
 * → availableFrom → createdAt. Einde: de vroegste van endDate/archivedAt.
 * Een ARCHIVED-rij zonder beide (pre-feature data) heeft geen kenbaar einde →
 * null betekent daar "geen raster" (afgehandeld door de caller).
 */
function assignmentWindow(
  a: {
    status: string;
    startDate: Date | null;
    publishedAt: Date | null;
    availableFrom: Date | null;
    createdAt: Date;
    endDate: Date | null;
    archivedAt: Date | null;
  },
  tz: string
): { startKey: string; endKey: string | null } | null {
  const start = a.startDate ?? a.publishedAt ?? a.availableFrom ?? a.createdAt;
  const ends = [a.endDate, a.archivedAt].filter((d): d is Date => d != null);
  const end = ends.length > 0 ? new Date(Math.min(...ends.map((d) => d.getTime()))) : null;
  if (a.status === "ARCHIVED" && end === null) return null; // einde onbekend
  return { startKey: dayKeyInTz(start, tz), endKey: end ? dayKeyInTz(end, tz) : null };
}

export async function getMemberAgenda(
  memberId: string,
  tenantId: string,
  requestedMonthKey: string | null
): Promise<AgendaMonth> {
  const tz = await getMemberCalendarTimezone(memberId, tenantId);
  const now = new Date();
  const todayKey = dayKeyInTz(now, tz);
  // Geen/ongeldige ?m= → de lopende maand in de tijdzone van het lid.
  const monthKey =
    requestedMonthKey && isValidMonthKey(requestedMonthKey)
      ? requestedMonthKey
      : todayKey.slice(0, 7);
  const gridKeys = monthGridDayKeys(monthKey);
  const firstKey = gridKeys[0];
  const lastKey = gridKeys[gridKeys.length - 1];

  // Instant-grenzen in de lid-tijdzone. De sessies-query is ±1 week verbreed:
  // de verschoven-/gemist-regel heeft op randweken de héle ISO-week nodig.
  const rangeStart = zonedInputToDate(`${firstKey}T00:00`, tz) ?? now;
  const rangeEnd = zonedInputToDate(`${addDaysToDayKey(lastKey, 1)}T00:00`, tz) ?? now;
  const wideStart = zonedInputToDate(`${addDaysToDayKey(firstKey, -7)}T00:00`, tz) ?? rangeStart;
  const wideEnd = zonedInputToDate(`${addDaysToDayKey(lastKey, 8)}T00:00`, tz) ?? rangeEnd;

  const [assignments, sessions, enrollments] = await Promise.all([
    // Toewijzingen mét weekdagplan — het raster geldt per toewijzing binnen
    // háár eigen venster (retrospectief blijft dus kloppen na hertoewijzing).
    prisma.assignedWorkout.findMany({
      where: {
        tenantId,
        userId: memberId,
        weekdayPlan: { not: Prisma.DbNull },
        status: { in: ["PUBLISHED", "ARCHIVED"] },
      },
      select: {
        status: true,
        startDate: true,
        publishedAt: true,
        availableFrom: true,
        createdAt: true,
        endDate: true,
        archivedAt: true,
        weekdayPlan: true,
        template: {
          select: {
            days: {
              orderBy: { order: "asc" },
              select: {
                id: true,
                name: true,
                items: {
                  orderBy: { order: "asc" },
                  select: {
                    sets: true,
                    reps: true,
                    restSeconds: true,
                    weightKg: true,
                    tempo: true,
                    params: true,
                    exercise: { select: { name: true, exerciseType: true } },
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.workoutSession.findMany({
      where: {
        tenantId,
        userId: memberId,
        endedAt: { not: null },
        startedAt: { gte: wideStart, lt: wideEnd },
      },
      orderBy: { startedAt: "asc" },
      select: { id: true, dayId: true, startedAt: true, endedAt: true, mood: true },
    }),
    prisma.classEnrollment.findMany({
      where: {
        tenantId,
        userId: memberId,
        status: { in: ["ENROLLED", "WAITLISTED", "ATTENDED", "NO_SHOW"] },
        session: { startsAt: { gte: rangeStart, lt: rangeEnd } },
      },
      select: {
        id: true,
        status: true,
        session: {
          select: {
            startsAt: true,
            endsAt: true,
            cancelledAt: true,
            location: true,
            venueLocation: { select: { name: true, timezone: true } },
            groupClass: { select: { name: true } },
          },
        },
      },
    }),
  ]);

  // Geplande rasters voorbereiden.
  const planned: PlannedAssignment[] = [];
  for (const a of assignments) {
    const plan = parseWeekdayPlan(a.weekdayPlan);
    const window = assignmentWindow(a, tz);
    if (!plan || !window || !a.template) continue;
    const dayMeta = new Map(
      a.template.days.map((d) => [
        d.id,
        {
          name: d.name,
          items: d.items.map((it) => ({
            name: it.exercise.name,
            summary: targetSummaryFromItem(it, it.exercise.exerciseType),
          })),
        },
      ])
    );
    planned.push({ plan, windowStartKey: window.startKey, windowEndKey: window.endKey, dayMeta });
  }

  // Sessies bucketen op kalenderdag in de lid-tijdzone.
  const sessionsByDay = new Map<string, typeof sessions>();
  const sessionLite: { dayId: string | null; dayKey: string }[] = [];
  for (const s of sessions) {
    const key = dayKeyInTz(s.startedAt, tz);
    sessionLite.push({ dayId: s.dayId, dayKey: key });
    const list = sessionsByDay.get(key) ?? [];
    list.push(s);
    sessionsByDay.set(key, list);
  }

  // Dagnamen van getrainde schema-dagen (dayId is bewust geen FK).
  const dayIds = [...new Set(sessions.map((s) => s.dayId).filter((v): v is string => v != null))];
  const dayNames = new Map(
    dayIds.length > 0
      ? (
          await prisma.workoutDay.findMany({
            where: { id: { in: dayIds }, tenantId },
            select: { id: true, name: true },
          })
        ).map((d) => [d.id, d.name] as const)
      : []
  );

  // Lessen bucketen (raster in lid-tz; tijden tonen we straks in venue-tz).
  const classesByDay = new Map<string, AgendaClassRow[]>();
  for (const e of enrollments) {
    const cancelled = e.session.cancelledAt != null;
    const row: AgendaClassRow = {
      id: e.id,
      title: e.session.groupClass.name,
      startIso: e.session.startsAt.toISOString(),
      endIso: e.session.endsAt.toISOString(),
      timezone: e.session.venueLocation.timezone,
      venueName: e.session.venueLocation.name,
      room: e.session.location,
      status: e.status as AgendaClassRow["status"],
      cancelled,
    };
    const key = dayKeyInTz(e.session.startsAt, tz);
    const list = classesByDay.get(key) ?? [];
    list.push(row);
    classesByDay.set(key, list);
  }

  // Per rasterdag: geplande statussen + gedane trainingen + lessen.
  const days: AgendaDay[] = gridKeys.map((dayKey) => {
    // Overlappende vensters: de toewijzing met de laatste start wint (een
    // nieuwe toewijzing vervangt de verwachting van de oude).
    const owner = planned
      .filter(
        (p) =>
          dayKey >= p.windowStartKey && (p.windowEndKey === null || dayKey <= p.windowEndKey)
      )
      .sort((a, b) => (a.windowStartKey < b.windowStartKey ? 1 : -1))[0];

    let plannedRows: AgendaPlannedRow[] = [];
    if (owner) {
      const weekStart = weekStartKeyOfDayKey(dayKey);
      const sessionsOfWeek = sessionLite.filter(
        (s) => weekStartKeyOfDayKey(s.dayKey) === weekStart
      );
      plannedRows = plannedDayStatuses({
        plan: owner.plan,
        dayKey,
        todayKey,
        sessionsOfWeek,
        windowStartKey: owner.windowStartKey,
        windowEndKey: owner.windowEndKey,
      })
        .map(({ dayId, status }) => {
          const meta = owner.dayMeta.get(dayId);
          if (!meta) return null;
          return { dayId, dayName: meta.name, status, items: meta.items };
        })
        .filter((r): r is AgendaPlannedRow => r !== null);
    }

    const sessionRows: AgendaSessionRow[] = (sessionsByDay.get(dayKey) ?? []).map((s) => ({
      id: s.id,
      dayName: s.dayId ? (dayNames.get(s.dayId) ?? null) : null,
      startIso: s.startedAt.toISOString(),
      durationMin: s.endedAt
        ? Math.max(1, Math.round((s.endedAt.getTime() - s.startedAt.getTime()) / 60_000))
        : null,
      mood: s.mood,
    }));

    return {
      dayKey,
      planned: plannedRows,
      sessions: sessionRows,
      classes: classesByDay.get(dayKey) ?? [],
    };
  });

  return { monthKey, timeZone: tz, todayKey, days };
}

// ---------- Weekdagplanner (bewerkdata) ----------

export type PlanEditorData = {
  assignmentId: string;
  plan: WeekdayPlan | null;
  days: DayRef[];
};

/** Actieve toewijzing + dagen voor de weekdagplanner; null = geen actief schema. */
export async function getPlanEditorData(
  memberId: string,
  tenantId: string
): Promise<PlanEditorData | null> {
  const row = await prisma.assignedWorkout.findFirst({
    where: activeAssignmentWhere(memberId, tenantId, new Date()),
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      weekdayPlan: true,
      template: {
        select: {
          days: { orderBy: { order: "asc" }, select: { id: true, name: true, order: true } },
        },
      },
    },
  });
  if (!row?.template) return null;
  return {
    assignmentId: row.id,
    plan: parseWeekdayPlan(row.weekdayPlan),
    days: row.template.days,
  };
}

// ---------- ICS-feed (publieke token-route) ----------

const FEED_FUTURE_DAYS = 42; // ~6 weken vooruit (alleen geplande dagen)
const FEED_PAST_DAYS = 28; // ~4 weken terug (gedane trainingen + lessen)

export type MemberFeedData = {
  tenantId: string;
  gymName: string;
  locale: Locale | null;
  timeZone: string;
  planned: { assignmentId: string; dayKey: string; dayName: string }[];
  classes: {
    enrollmentId: string;
    title: string;
    startsAt: Date;
    endsAt: Date;
    venueName: string | null;
    room: string | null;
    waitlisted: boolean;
    cancelled: boolean;
  }[];
  sessions: { id: string; startsAt: Date; endsAt: Date; dayName: string | null }[];
};

/**
 * Ruwe feed-rijen voor de ICS-route. Geplande dagen alleen vanaf vandaag (het
 * verleden komt uitsluitend uit de gedane trainingen, anders staat een gedane
 * geplande dag dubbel); lessen en sessies over de afgelopen ~4 weken zodat de
 * kalender van het lid ook de historie toont. Annuleringen en afmeldingen gaan
 * mee als rij (de route zet er STATUS:CANCELLED op zodat providers het event
 * verwijderen in plaats van een verouderde kopie te laten staan).
 */
export async function getMemberFeedEvents(
  userId: string,
  tenantId: string
): Promise<MemberFeedData | null> {
  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId },
    select: { locale: true, tenant: { select: { name: true } } },
  });
  if (!user?.tenant) return null;

  const tz = await getMemberCalendarTimezone(userId, tenantId);
  const now = new Date();
  const todayKey = dayKeyInTz(now, tz);
  const pastStart = new Date(now.getTime() - FEED_PAST_DAYS * 86_400_000);
  const futureEnd = new Date(now.getTime() + (FEED_FUTURE_DAYS + 1) * 86_400_000);

  const [assignment, enrollments, sessions] = await Promise.all([
    prisma.assignedWorkout.findFirst({
      where: activeAssignmentWhere(userId, tenantId, now),
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        status: true,
        startDate: true,
        publishedAt: true,
        availableFrom: true,
        createdAt: true,
        endDate: true,
        archivedAt: true,
        weekdayPlan: true,
        template: {
          select: { days: { orderBy: { order: "asc" }, select: { id: true, name: true } } },
        },
      },
    }),
    prisma.classEnrollment.findMany({
      where: {
        tenantId,
        userId,
        status: { in: ["ENROLLED", "WAITLISTED", "ATTENDED", "NO_SHOW", "CANCELLED"] },
        session: { startsAt: { gte: pastStart, lt: futureEnd } },
      },
      select: {
        id: true,
        status: true,
        session: {
          select: {
            startsAt: true,
            endsAt: true,
            cancelledAt: true,
            location: true,
            venueLocation: { select: { name: true } },
            groupClass: { select: { name: true } },
          },
        },
      },
    }),
    prisma.workoutSession.findMany({
      where: { tenantId, userId, endedAt: { not: null }, startedAt: { gte: pastStart } },
      orderBy: { startedAt: "asc" },
      select: { id: true, dayId: true, startedAt: true, endedAt: true },
    }),
  ]);

  // Geplande dagen: vandaag t/m de horizon, geknipt op het toewijzingsvenster.
  const planned: MemberFeedData["planned"] = [];
  if (assignment?.template) {
    const plan = parseWeekdayPlan(assignment.weekdayPlan);
    const window = assignmentWindow(assignment, tz);
    if (plan && window) {
      const names = new Map(assignment.template.days.map((d) => [d.id, d.name]));
      const horizonKey = addDaysToDayKey(todayKey, FEED_FUTURE_DAYS);
      let k = todayKey < window.startKey ? window.startKey : todayKey;
      const endKey =
        window.endKey !== null && window.endKey < horizonKey ? window.endKey : horizonKey;
      for (; k <= endKey; k = addDaysToDayKey(k, 1)) {
        for (const dayId of plannedDayIdsOnDate(plan, k)) {
          const dayName = names.get(dayId);
          if (dayName) planned.push({ assignmentId: assignment.id, dayKey: k, dayName });
        }
      }
    }
  }

  const dayIds = [...new Set(sessions.map((s) => s.dayId).filter((v): v is string => v != null))];
  const dayNames = new Map(
    dayIds.length > 0
      ? (
          await prisma.workoutDay.findMany({
            where: { id: { in: dayIds }, tenantId },
            select: { id: true, name: true },
          })
        ).map((d) => [d.id, d.name] as const)
      : []
  );

  return {
    tenantId,
    gymName: user.tenant.name,
    locale: user.locale,
    timeZone: tz,
    planned,
    classes: enrollments.map((e) => ({
      enrollmentId: e.id,
      title: e.session.groupClass.name,
      startsAt: e.session.startsAt,
      endsAt: e.session.endsAt,
      venueName: e.session.venueLocation.name,
      room: e.session.location,
      waitlisted: e.status === "WAITLISTED",
      cancelled: e.status === "CANCELLED" || e.session.cancelledAt != null,
    })),
    sessions: sessions.map((s) => ({
      id: s.id,
      startsAt: s.startedAt,
      endsAt: s.endedAt!,
      dayName: s.dayId ? (dayNames.get(s.dayId) ?? null) : null,
    })),
  };
}

// ---------- Carry-over bij hertoewijzing ----------

export type CarriedPlan = { plan: WeekdayPlan; days: DayRef[] };

/**
 * Lees het weekdagplan van de huidige actieve (PUBLISHED) toewijzing — aanroepen
 * VÓÓR `archivePriorActive`, in dezelfde transactie. `exceptAssignmentId` sluit
 * de toewijzing uit die juist live gezet wordt (lid-builder `activate`).
 */
export async function capturePlanForCarryOver(
  tx: Prisma.TransactionClient,
  tenantId: string,
  userId: string,
  exceptAssignmentId?: string
): Promise<CarriedPlan | null> {
  const rows = await tx.assignedWorkout.findMany({
    where: {
      tenantId,
      userId,
      status: "PUBLISHED",
      weekdayPlan: { not: Prisma.DbNull },
      ...(exceptAssignmentId ? { id: { not: exceptAssignmentId } } : {}),
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    select: {
      weekdayPlan: true,
      template: {
        select: {
          days: { orderBy: { order: "asc" }, select: { id: true, name: true, order: true } },
        },
      },
    },
  });
  for (const row of rows) {
    const plan = parseWeekdayPlan(row.weekdayPlan);
    if (plan && row.template) return { plan, days: row.template.days };
  }
  return null;
}

/**
 * Pas een meegenomen weekdagplan toe op de nieuwe/actieve toewijzing (dagen
 * matchen op naam, anders volgorde — zie carryOverWeekdayPlan). No-op zonder
 * meegenomen plan; een al aanwezig plan op het doel wordt nooit overschreven.
 */
export async function applyCarriedPlan(
  tx: Prisma.TransactionClient,
  args: { tenantId: string; assignmentId: string; carried: CarriedPlan | null }
): Promise<void> {
  if (!args.carried) return;
  const target = await tx.assignedWorkout.findFirst({
    where: { id: args.assignmentId, tenantId: args.tenantId },
    select: {
      weekdayPlan: true,
      template: {
        select: {
          days: { orderBy: { order: "asc" }, select: { id: true, name: true, order: true } },
        },
      },
    },
  });
  if (!target?.template || parseWeekdayPlan(target.weekdayPlan)) return;
  const next = carryOverWeekdayPlan(args.carried.plan, args.carried.days, target.template.days);
  if (!next) return;
  await tx.assignedWorkout.update({
    where: { id: args.assignmentId },
    // WeekdayPlan is een plat JSON-object; Prisma's Json-input kent het type niet.
    data: { weekdayPlan: next as Prisma.InputJsonValue },
  });
}
