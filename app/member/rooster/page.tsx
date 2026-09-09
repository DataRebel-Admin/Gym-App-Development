import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { requireMember } from "@/lib/member";
import { areClassesEnabled } from "@/lib/classes";
import Link from "next/link";
import { prisma } from "@/lib/db";
import type { EnrollmentStatus, Prisma } from "@prisma/client";
import {
  ACTIVE_ENROLLMENT_STATUSES,
  ROSTER_HORIZON_DAYS,
  enrollmentWindowOpen,
  sessionCapacity,
} from "@/lib/class-attendance";
import { getTenantLocations } from "@/lib/locations";
import { resolveActiveLocationId } from "@/lib/location-resolve";
import { getMemberCalendarTimezone } from "@/lib/calendar";
import {
  isValidDayKey,
  isValidMonthKey,
  monthGridDayKeys,
  monthKeyOfDayKey,
  nextMonthKey,
  prevMonthKey,
} from "@/lib/calendar-plan";
import { dayKeyInTz } from "@/lib/metrics/definitions";
import { zonedInputToDate } from "@/lib/tz";
import { Reveal, RevealItem } from "@/components/motion/reveal";
import { EmptyState } from "@/components/ui/empty-state";
import { CalendarDays } from "@/components/ui/icons";
import { ClassInfoButton } from "@/components/classes/class-info";
import { ClassCalendar } from "@/components/classes/class-calendar";
import { ClassCard, type SessionCard } from "@/components/classes/class-card";
import { ClassGroupList } from "@/components/classes/class-group-list";
import { type RoosterMessage } from "./actions";

export async function generateMetadata() {
  const t = await getTranslations("member.rooster");
  return { title: t("metaTitle") };
}

const MESSAGES: Record<RoosterMessage, string> = {
  enrolled: "msgEnrolled",
  waitlisted: "msgWaitlisted",
  closed: "msgClosed",
  unchanged: "msgUnchanged",
  unenrolled: "msgUnenrolled",
};

export default async function MemberRoosterPage({
  searchParams,
}: {
  searchParams: Promise<{
    loc?: string;
    msg?: string;
    overlap?: string;
    view?: string;
    type?: string;
    m?: string;
    d?: string;
  }>;
}) {
  const member = await requireMember();
  if (!(await areClassesEnabled(member.tenantId))) notFound();
  const [t, ta, locale] = await Promise.all([
    getTranslations("member.rooster"),
    getTranslations("member.agenda"),
    getLocale(),
  ]);
  const { loc, msg, overlap, view, type, m, d } = await searchParams;
  const now = new Date();
  const agendaView = view === "agenda";

  const [locations, me, classTypes] = await Promise.all([
    getTenantLocations(member.tenantId),
    prisma.user.findFirst({
      where: { id: member.id, tenantId: member.tenantId },
      select: { homeLocationId: true },
    }),
    // Filterchips + omschrijvingen: álle lestypes die de sportschool heeft
    // aangemaakt, ook als er deze maand geen sessie van gepland staat.
    prisma.groupClass.findMany({
      where: { tenantId: member.tenantId },
      select: { id: true, name: true, description: true },
      orderBy: { name: "asc" },
    }),
  ]);

  // Vestiging-badge + filter alleen bij een multi-vestiging-organisatie.
  const multiLocation = locations.length > 1;

  // Standaard gefilterd op de eigen (actieve/thuis)vestiging; `?loc=all` toont
  // alles, `?loc=<id>` een specifieke vestiging. Het filter zit in de query
  // (niet erna), anders kapt `take` de lijst af vóór het filteren.
  const validIds = new Set(locations.map((l) => l.id));
  const selectedLocationId = !multiLocation
    ? null
    : loc === "all"
      ? null
      : loc && validIds.has(loc)
        ? loc
        : await resolveActiveLocationId(member.tenantId, {
            homeLocationId: me?.homeLocationId,
          });

  // Lestype-filter: alleen een id dat echt van deze sportschool is.
  const selectedTypeId = type && classTypes.some((c) => c.id === type) ? type : null;

  const MINE_STATUSES: EnrollmentStatus[] = ["ENROLLED", "WAITLISTED"];
  const sessionInclude = {
    groupClass: {
      select: { name: true, description: true, instructorName: true, maxParticipants: true },
    },
    venueLocation: { select: { name: true, timezone: true } },
    // Capaciteit telt alleen actieve statussen (afgemeld/no-show/wachtlijst bezet geen plek).
    _count: {
      select: { enrollments: { where: { status: { in: [...ACTIVE_ENROLLMENT_STATUSES] } } } },
    },
    // Wachtlijst (op volgorde) voor de eigen positie + teller.
    enrollments: {
      where: { status: { in: MINE_STATUSES } },
      orderBy: { enrolledAt: "asc" },
      select: { userId: true, status: true },
    },
  } satisfies Prisma.ClassSessionInclude;

  // Dag-bucketing in de tijdzone van het lid (thuisvestiging → default →
  // Europe/Amsterdam), net als de persoonlijke agenda. De lestíjd zelf blijft
  // in de venue-klok staan; dat is een andere vraag dan "op welke dag valt dit".
  const tz = await getMemberCalendarTimezone(member.id, member.tenantId);
  const todayKey = dayKeyInTz(now, tz);
  const monthKey = m && isValidMonthKey(m) ? m : monthKeyOfDayKey(todayKey);
  const gridKeys = monthGridDayKeys(monthKey);

  const typeWhere = selectedTypeId ? { classId: selectedTypeId } : {};
  const locationWhere = selectedLocationId ? { locationId: selectedLocationId } : {};

  // Vaste horizon i.p.v. een rij-limiet: met een paar wekelijkse reeksen kapte
  // `take: 40` het rooster al na ±2 weken stil af — een datumgrens is
  // voorspelbaar ("je ziet altijd 3 weken vooruit"). De take blijft als
  // vangnet tegen een extreem vol rooster.
  const horizon = new Date(now.getTime() + ROSTER_HORIZON_DAYS * 24 * 3_600_000);

  // In de agenda-weergave telt het hele maandraster (maandag vóór de 1e t/m
  // zondag ná de laatste), inclusief het verleden: de kalender is er juist ook
  // om terug te kijken. In de lijst blijft het "wat komt eraan".
  const monthStart =
    zonedInputToDate(`${gridKeys[0]}T00:00`, tz) ?? new Date(`${gridKeys[0]}T00:00:00Z`);
  const monthEnd =
    zonedInputToDate(`${gridKeys[gridKeys.length - 1]}T23:59`, tz) ??
    new Date(`${gridKeys[gridKeys.length - 1]}T23:59:59Z`);

  const [listRows, mineRows] = await Promise.all([
    prisma.classSession.findMany({
      where: {
        tenantId: member.tenantId,
        ...(agendaView
          ? { startsAt: { gte: monthStart, lte: monthEnd } }
          : // Lopende lessen blijven even zichtbaar (gestart, niet meer boekbaar).
            { endsAt: { gte: now }, startsAt: { lte: horizon } }),
        ...locationWhere,
        ...typeWhere,
      },
      orderBy: { startsAt: "asc" },
      take: agendaView ? 400 : 200,
      include: sessionInclude,
    }),
    // "Mijn lessen" blijft bewust ongefilterd: eigen aanmeldingen zie je altijd.
    prisma.classSession.findMany({
      where: {
        tenantId: member.tenantId,
        endsAt: { gte: now },
        enrollments: { some: { userId: member.id, status: { in: MINE_STATUSES } } },
      },
      orderBy: { startsAt: "asc" },
      include: sessionInclude,
    }),
  ]);

  const toCard = (s: (typeof listRows)[number]): SessionCard => {
    const waiting = s.enrollments.filter((e) => e.status === "WAITLISTED");
    const own = s.enrollments.find((e) => e.userId === member.id);
    const max = sessionCapacity(s);
    const count = s._count.enrollments;
    return {
      id: s.id,
      classId: s.classId,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
      timezone: s.venueLocation.timezone,
      locationId: s.locationId,
      venueName: multiLocation ? s.venueLocation.name : null,
      location: s.location,
      className: s.groupClass.name,
      description: s.groupClass.description,
      instructorName: s.groupClass.instructorName,
      cancelled: s.cancelledAt !== null,
      past: s.endsAt < now,
      mine: own ? (own.status === "ENROLLED" ? "enrolled" : "waitlisted") : null,
      waitlistPosition:
        own?.status === "WAITLISTED" ? waiting.findIndex((e) => e.userId === member.id) + 1 : null,
      waitlistCount: waiting.length,
      full: count >= max,
      started: !enrollmentWindowOpen(s, now),
      spotsLeft: Math.max(0, max - count),
      count,
      max,
    };
  };

  const mine = mineRows.map(toCard);
  const listCards = listRows.map(toCard);

  // Agenda: tellingen per dag + de dagen waarop het lid zelf staat ingeschreven.
  const counts: Record<string, number> = {};
  const mineDays: Record<string, boolean> = {};
  const byDay: Record<string, SessionCard[]> = {};
  if (agendaView) {
    for (const card of listCards) {
      const key = dayKeyInTz(card.startsAt, tz);
      counts[key] = (counts[key] ?? 0) + 1;
      if (card.mine !== null) mineDays[key] = true;
      const bucket = byDay[key];
      if (bucket) bucket.push(card);
      else byDay[key] = [card];
    }
  }

  // De dagkeuze zit in `ClassCalendar` (overlay, geen navigatie). `?d=` blijft
  // alleen bestaan als deelbare link die meteen op die dag opent — bewust
  // zónder terugval op vandaag, anders springt de overlay bij élk bezoek open.
  const gridSet = new Set(gridKeys);
  const initialDayKey = agendaView && d && isValidDayKey(d) && gridSet.has(d) ? d : null;

  // Links behouden de andere filters. `msg`/`overlap` gaan bewust niet mee:
  // dat is een eenmalige terugkoppeling op een actie.
  const currentParams: Record<string, string | null> = {
    view: agendaView ? "agenda" : null,
    loc: loc ?? null,
    type: selectedTypeId,
    m: agendaView && monthKey !== monthKeyOfDayKey(todayKey) ? monthKey : null,
  };
  const hrefWith = (overrides: Record<string, string | null> = {}) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...currentParams, ...overrides })) if (v) p.set(k, v);
    const query = p.toString();
    return query ? `/member/rooster?${query}` : "/member/rooster";
  };
  // Gaat mee met aan-/afmelden zodat je ná de actie terugkomt in dezelfde
  // weergave, maand en filters (de action laat alleen bekende sleutels door).
  const formQuery = hrefWith().split("?")[1] ?? "";

  const [year, monthNo] = monthKey.split("-").map(Number);
  const monthTitle = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, monthNo - 1, 1)));

  const message = msg && msg in MESSAGES ? MESSAGES[msg as RoosterMessage] : null;
  const messageTone =
    msg === "closed" || msg === "unchanged" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-green-200 bg-green-50 text-green-900";

  const filterTab = (active: boolean) =>
    active
      ? "shrink-0 rounded-full bg-accent px-3.5 py-1.5 text-xs font-bold text-accent-foreground"
      : "shrink-0 rounded-full border border-border bg-surface-1 px-3.5 py-1.5 text-xs font-medium text-neutral-600 active:bg-surface-2";
  const viewTab = (active: boolean) =>
    active
      ? "flex-1 rounded-lg bg-surface-1 px-3 py-1.5 text-center text-sm font-bold text-neutral-900 shadow-sm"
      : "flex-1 rounded-lg px-3 py-1.5 text-center text-sm font-medium text-neutral-500";

  const selectedType = classTypes.find((c) => c.id === selectedTypeId) ?? null;

  return (
    <Reveal stagger className="flex flex-1 flex-col gap-6 px-5 py-8">
      <RevealItem>
        <h1 className="font-display text-2xl font-bold tracking-tight text-neutral-900">{t("title")}</h1>
        <p className="mt-1 text-sm text-neutral-500">{t("subtitle")}</p>
      </RevealItem>

      {message ? (
        <RevealItem className="flex flex-col gap-2">
          <p role="status" className={`rounded-xl border px-4 py-3 text-sm ${messageTone}`}>
            {t(message)}
          </p>
          {overlap === "1" ? (
            <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {t("msgOverlap")}
            </p>
          ) : null}
        </RevealItem>
      ) : null}

      {mine.length > 0 ? (
        <RevealItem className="flex flex-col gap-3">
          <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-400">{t("myClasses")}</h2>
          <div className="flex flex-col gap-2.5">
            {mine.map((s) => (
              <ClassCard key={`mine-${s.id}`} s={s} q={formQuery} />
            ))}
          </div>
        </RevealItem>
      ) : null}

      <RevealItem className="flex flex-col gap-3">
        <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-400">{t("upcoming")}</h2>

        {/* Weergave: lijst (wat komt eraan) of agenda (maandoverzicht).

            ELKE LINK OP DEZE PAGINA DRAAGT `scroll={false}`. De searchParams
            zitten in de segmentsleutel van Next, dus een filterwissel telt als
            een nieuw segment: de router maakt een verse scrollRef aan en zet
            `documentElement.scrollTop` op 0. Deze chiprijen staan onder de
            sectie "Mijn lessen" en dus vaak onder de vouw — zonder de vlag
            sprong de pagina bij élke tik naar boven en moest je terugscrollen
            naar de rij die je net had aangeraakt. De maandnavigatie in
            class-calendar.tsx deed dit al. */}
        <div className="flex gap-1 rounded-xl bg-surface-2 p-1">
          <Link href={hrefWith({ view: null, m: null, d: null })} scroll={false} className={viewTab(!agendaView)}>
            {t("viewList")}
          </Link>
          <Link href={hrefWith({ view: "agenda" })} scroll={false} className={viewTab(agendaView)}>
            {t("viewAgenda")}
          </Link>
        </div>

        {/* Filter op lestype. Let op: geen info-icoon in deze rij, een
            `overflow-x-auto`-container klipt het popover-paneel weg. */}
        {classTypes.length > 1 ? (
          <div className="-mx-5 flex gap-1.5 overflow-x-auto px-5 pb-1">
            <Link href={hrefWith({ type: null })} scroll={false} className={filterTab(selectedTypeId === null)}>
              {t("allTypes")}
            </Link>
            {classTypes.map((c) => (
              <Link
                key={c.id}
                href={hrefWith({ type: c.id })}
                scroll={false}
                className={filterTab(selectedTypeId === c.id)}
              >
                {c.name}
              </Link>
            ))}
          </div>
        ) : null}

        {/* Het gekozen lestype met z'n info-knop, buiten de scrollrij. */}
        {selectedType?.description ? (
          <div className="flex items-center gap-1 text-sm text-neutral-500">
            <span>{t("filteredOn", { name: selectedType.name })}</span>
            <ClassInfoButton name={selectedType.name} description={selectedType.description} align="start" />
          </div>
        ) : null}

        {multiLocation ? (
          <div className="-mx-5 flex gap-1.5 overflow-x-auto px-5 pb-1">
            <Link href={hrefWith({ loc: "all" })} scroll={false} className={filterTab(selectedLocationId === null)}>
              {t("allLocations")}
            </Link>
            {locations.map((l) => (
              <Link
                key={l.id}
                href={hrefWith({ loc: l.id })}
                scroll={false}
                className={filterTab(selectedLocationId === l.id)}
              >
                {l.name}
              </Link>
            ))}
          </div>
        ) : null}

        {agendaView ? (
          <ClassCalendar
            monthKey={monthKey}
            todayKey={todayKey}
            counts={counts}
            mineDays={mineDays}
            sessionsByDay={byDay}
            initialDayKey={initialDayKey}
            formQuery={formQuery}
            monthTitle={monthTitle}
            weekdayLabels={[1, 2, 3, 4, 5, 6, 7].map((n) => ta(`wd${n}`))}
            prevHref={hrefWith({ m: prevMonthKey(monthKey) })}
            nextHref={hrefWith({ m: nextMonthKey(monthKey) })}
            prevLabel={ta("monthPrev")}
            nextLabel={ta("monthNext")}
          />
        ) : listCards.length === 0 ? (
          <EmptyState
            icon={<CalendarDays className="size-7 text-accent" />}
            title={t("emptyTitle")}
            description={selectedTypeId ? t("emptyTypeDesc") : t("emptyDesc")}
          />
        ) : (
          <ClassGroupList sessions={listCards} q={formQuery} />
        )}
      </RevealItem>
    </Reveal>
  );
}
