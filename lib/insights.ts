import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import { ACTIVE_ENROLLMENT_STATUSES } from "@/lib/class-attendance";
import {
  locationScopeWhere,
  scopeCacheKey,
  type LocationScope,
} from "@/lib/location-scope";
import { ACTIVE_MEMBER_WHERE, hourPartsInTz } from "@/lib/metrics/definitions";

const DAY_MS = 86_400_000;

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function daysAgo(n: number): Date {
  return new Date(Date.now() - n * DAY_MS);
}

const WEEKDAY_LABELS = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];

/** Sessie-relatiefilter voor entry-queries: vestiging-scope via de sessie. */
function sessionScopeFilter(scope: LocationScope): { locationId?: { in: string[] } } {
  return scope.kind === "locations" ? { locationId: { in: scope.ids } } : {};
}

/** Aantal sessies per machine (op basis van distinct sessies) sinds `since`. */
async function machineSessionCounts(
  tenantId: string,
  scope: LocationScope,
  since: Date
): Promise<Map<string, Set<string>>> {
  const entries = await prisma.performanceEntry.findMany({
    where: {
      tenantId,
      exercise: { machineId: { not: null } },
      session: { ...sessionScopeFilter(scope), startedAt: { gte: since } },
    },
    select: { sessionId: true, exercise: { select: { machineId: true } } },
  });

  const byMachine = new Map<string, Set<string>>();
  for (const e of entries) {
    const mId = e.exercise.machineId;
    if (!mId) continue;
    if (!byMachine.has(mId)) byMachine.set(mId, new Set());
    byMachine.get(mId)!.add(e.sessionId);
  }
  return byMachine;
}

export type RecentActivity = {
  id: string;
  member: string;
  startedAt: string; // ISO
  exercises: number;
};

export type PopularExercise = { id: string; name: string; count: number };
export type ClassOccupancy = {
  name: string;
  startsAt: string; // ISO
  enrolled: number;
  capacity: number;
};

export type DashboardStats = {
  activeToday: number;
  memberCount: number;
  sessionsThisWeek: number;
  machineCount: number;
  newSignups: number; // leden aangemaakt laatste 30 dagen
  signupsTrend: number | null; // ±% t.o.v. vorige 30 dagen
  sessionsTrend: number | null; // ±% sessies deze week vs vorige
  popularExercises: PopularExercise[];
  classOccupancy: ClassOccupancy[];
  topMachines: { id: string; name: string; sessions: number }[];
  bottomMachines: { id: string; name: string; sessions: number }[];
  perWeekday: { day: string; sessies: number }[];
  perWeek: { label: string; sessies: number }[];
  recent: RecentActivity[];
};

function trendPct(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 100);
}

async function computeDashboard(
  tenantId: string,
  scope: LocationScope
): Promise<DashboardStats> {
  // Scope-fragmenten: tabellen mét eigen locationId (sessies/machines/lessen)
  // filteren direct; entry-queries via de sessie-relatie (sessionScopeFilter).
  const scoped = locationScopeWhere(tenantId, scope);

  const machines = await prisma.machine.findMany({
    where: scoped,
    select: { id: true, name: true },
  });
  const nameById = new Map(machines.map((m) => [m.id, m.name]));

  // Actieve leden vandaag: DISTINCT leden (gedeelde definitie — een lid met twee
  // sessies telt één keer; binnen een vestiging-scope: distinct actief aldáár).
  const activeRows = await prisma.workoutSession.findMany({
    where: { ...scoped, startedAt: { gte: startOfToday() } },
    distinct: ["userId"],
    select: { userId: true },
  });

  // KPI's: ledenaantal, sessies deze week, recente activiteit. Ledenaantal =
  // dé actief-lid-definitie (lib/metrics/definitions.ts — mét archivedAt-check);
  // binnen een vestiging-scope tellen leden met die thuisvestiging.
  const [memberCount, sessionsThisWeek, recentSessions] = await Promise.all([
    prisma.user.count({
      where: {
        tenantId,
        ...ACTIVE_MEMBER_WHERE,
        ...(scope.kind === "locations" ? { homeLocationId: { in: scope.ids } } : {}),
      },
    }),
    prisma.workoutSession.count({
      where: { ...scoped, startedAt: { gte: daysAgo(7) } },
    }),
    prisma.workoutSession.findMany({
      where: scoped,
      orderBy: { startedAt: "desc" },
      take: 6,
      select: {
        id: true,
        startedAt: true,
        user: { select: { name: true, email: true } },
        _count: { select: { performanceEntries: true } },
      },
    }),
  ]);

  const recent: RecentActivity[] = recentSessions.map((s) => ({
    id: s.id,
    member: s.user?.name ?? s.user?.email ?? "Onbekend lid",
    startedAt: s.startedAt.toISOString(),
    exercises: s._count.performanceEntries,
  }));

  // Nieuwe aanmeldingen (leden) + groeitrend (vestiging-scope: thuisvestiging).
  const signupScope =
    scope.kind === "locations" ? { homeLocationId: { in: scope.ids } } : {};
  const [signupsNow, signupsPrev, sessionsPrevWeek] = await Promise.all([
    prisma.user.count({
      where: { tenantId, role: "TENANT_MEMBER", ...signupScope, createdAt: { gte: daysAgo(30) } },
    }),
    prisma.user.count({
      where: {
        tenantId,
        role: "TENANT_MEMBER",
        ...signupScope,
        createdAt: { gte: daysAgo(60), lt: daysAgo(30) },
      },
    }),
    prisma.workoutSession.count({
      where: { ...scoped, startedAt: { gte: daysAgo(14), lt: daysAgo(7) } },
    }),
  ]);

  // Populaire oefeningen (op basis van prestatie-entries, laatste 30 dagen).
  const exerciseGroups = await prisma.performanceEntry.groupBy({
    by: ["exerciseId"],
    where: {
      tenantId,
      session: { ...sessionScopeFilter(scope), startedAt: { gte: daysAgo(30) } },
    },
    _count: { exerciseId: true },
    orderBy: { _count: { exerciseId: "desc" } },
    take: 5,
  });
  const exerciseNames = await prisma.exercise.findMany({
    where: { tenantId, id: { in: exerciseGroups.map((g) => g.exerciseId) } },
    select: { id: true, name: true },
  });
  const exNameById = new Map(exerciseNames.map((e) => [e.id, e.name]));
  const popularExercises: PopularExercise[] = exerciseGroups.map((g) => ({
    id: g.exerciseId,
    name: exNameById.get(g.exerciseId) ?? "Onbekend",
    count: g._count.exerciseId,
  }));

  // Bezetting van komende lessen.
  const upcoming = await prisma.classSession.findMany({
    where: { ...scoped, startsAt: { gte: new Date() } },
    orderBy: { startsAt: "asc" },
    take: 5,
    select: {
      startsAt: true,
      groupClass: { select: { name: true, maxParticipants: true } },
      // Capaciteit telt alleen actieve statussen (lib/class-attendance.ts).
      _count: {
        select: { enrollments: { where: { status: { in: [...ACTIVE_ENROLLMENT_STATUSES] } } } },
      },
    },
  });
  const classOccupancy: ClassOccupancy[] = upcoming.map((c) => ({
    name: c.groupClass.name,
    startsAt: c.startsAt.toISOString(),
    enrolled: c._count.enrollments,
    capacity: c.groupClass.maxParticipants,
  }));

  // Top 5 deze week.
  const weekCounts = await machineSessionCounts(tenantId, scope, daysAgo(7));
  const topMachines = [...weekCounts.entries()]
    .map(([id, set]) => ({ id, name: nameById.get(id) ?? "?", sessions: set.size }))
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 5);

  // Bottom 3 deze maand (incl. machines met 0 gebruik).
  const monthCounts = await machineSessionCounts(tenantId, scope, daysAgo(30));
  const bottomMachines = machines
    .map((m) => ({ id: m.id, name: m.name, sessions: monthCounts.get(m.id)?.size ?? 0 }))
    .sort((a, b) => a.sessions - b.sessions)
    .slice(0, 3);

  // Sessies per weekdag (laatste 30 dagen) — gebucket in de tijdzone van de
  // VESTIGING van de sessie (niet de servertijd; zie lib/metrics/definitions.ts).
  const [sessions30, tzLocations] = await Promise.all([
    prisma.workoutSession.findMany({
      where: { ...scoped, startedAt: { gte: daysAgo(30) } },
      select: { startedAt: true, locationId: true },
    }),
    prisma.location.findMany({
      where: { tenantId },
      select: { id: true, timezone: true },
    }),
  ]);
  const tzByLocation = new Map(tzLocations.map((l) => [l.id, l.timezone]));
  const weekdayCounts = new Array(7).fill(0);
  for (const s of sessions30) {
    const tz = tzByLocation.get(s.locationId) ?? "Europe/Amsterdam";
    weekdayCounts[hourPartsInTz(s.startedAt, tz).weekday]++;
  }
  const perWeekday = WEEKDAY_LABELS.map((day, i) => ({
    day,
    sessies: weekdayCounts[i],
  }));

  // Sessies per week (laatste 12 weken).
  const sessions84 = await prisma.workoutSession.findMany({
    where: { ...scoped, startedAt: { gte: daysAgo(84) } },
    select: { startedAt: true },
  });
  const weeks = 12;
  const now = Date.now();
  const perWeek = Array.from({ length: weeks }, (_, i) => {
    const end = new Date(now - (weeks - 1 - i) * 7 * DAY_MS);
    return { label: `${end.getDate()}/${end.getMonth() + 1}`, sessies: 0 };
  });
  for (const s of sessions84) {
    const weekAgo = Math.floor((now - s.startedAt.getTime()) / (7 * DAY_MS));
    if (weekAgo >= 0 && weekAgo < weeks) perWeek[weeks - 1 - weekAgo].sessies++;
  }

  return {
    activeToday: activeRows.length,
    memberCount,
    sessionsThisWeek,
    machineCount: machines.length,
    newSignups: signupsNow,
    signupsTrend: trendPct(signupsNow, signupsPrev),
    sessionsTrend: trendPct(sessionsThisWeek, sessionsPrevWeek),
    popularExercises,
    classOccupancy,
    topMachines,
    bottomMachines,
    perWeekday,
    perWeek,
    recent,
  };
}

export function getDashboardStats(
  tenantId: string,
  scope: LocationScope
): Promise<DashboardStats> {
  // LET OP: `scopeCacheKey` MOET in de keyParts — zonder deelt een
  // vestigingsmanager de cache met de eigenaar en lekt er tot 300s lang
  // verkeerd-gescopede data (zie lib/location-scope.ts).
  return unstable_cache(
    () => computeDashboard(tenantId, scope),
    ["owner-dashboard", tenantId, scopeCacheKey(scope)],
    { revalidate: 300 }
  )();
}

export type PopularExerciseRow = {
  id: string;
  name: string;
  count: number;
  trendPct: number | null; // entries t.o.v. de voorgaande periode van gelijke lengte
};

async function computePopularExercises(
  tenantId: string,
  periodDays: number,
  scope: LocationScope,
  limit: number
): Promise<PopularExerciseRow[]> {
  // Anders dan de 30d-dashboardvariant: periode-parametrisch én met trend.
  const current = await prisma.performanceEntry.groupBy({
    by: ["exerciseId"],
    where: {
      tenantId,
      session: { ...sessionScopeFilter(scope), startedAt: { gte: daysAgo(periodDays) } },
    },
    _count: { exerciseId: true },
    orderBy: { _count: { exerciseId: "desc" } },
    take: limit,
  });
  if (current.length === 0) return [];

  const ids = current.map((g) => g.exerciseId);
  // Vorige periode alleen voor de top-ids (geen N+1, geen volle scan).
  const [previous, names] = await Promise.all([
    prisma.performanceEntry.groupBy({
      by: ["exerciseId"],
      where: {
        tenantId,
        exerciseId: { in: ids },
        session: {
          ...sessionScopeFilter(scope),
          startedAt: { gte: daysAgo(periodDays * 2), lt: daysAgo(periodDays) },
        },
      },
      _count: { exerciseId: true },
    }),
    prisma.exercise.findMany({
      where: { tenantId, id: { in: ids } },
      select: { id: true, name: true },
    }),
  ]);
  const prevById = new Map(previous.map((g) => [g.exerciseId, g._count.exerciseId]));
  const nameById = new Map(names.map((e) => [e.id, e.name]));

  return current.map((g) => ({
    id: g.exerciseId,
    name: nameById.get(g.exerciseId) ?? "Onbekend",
    count: g._count.exerciseId,
    trendPct: trendPct(g._count.exerciseId, prevById.get(g.exerciseId) ?? 0),
  }));
}

export function getPopularExercises(
  tenantId: string,
  periodDays: number,
  scope: LocationScope,
  limit = 8
): Promise<PopularExerciseRow[]> {
  // Scope + periode verplicht in de keyParts (zie getDashboardStats).
  return unstable_cache(
    () => computePopularExercises(tenantId, periodDays, scope, limit),
    ["popular-exercises", tenantId, String(periodDays), String(limit), scopeCacheKey(scope)],
    { revalidate: 300 }
  )();
}

export type MachineInsightRow = {
  id: string;
  name: string;
  sessions: number;
  totalReps: number;
  trendPct: number | null; // t.o.v. vorige periode (sessies)
};

async function computeInsights(
  tenantId: string,
  periodDays: number,
  scope: LocationScope
): Promise<MachineInsightRow[]> {
  const machines = await prisma.machine.findMany({
    where: locationScopeWhere(tenantId, scope),
    select: { id: true, name: true },
  });

  const currentStart = daysAgo(periodDays);
  const prevStart = daysAgo(periodDays * 2);

  const entries = await prisma.performanceEntry.findMany({
    where: {
      tenantId,
      exercise: { machineId: { not: null } },
      session: { ...sessionScopeFilter(scope), startedAt: { gte: prevStart } },
    },
    select: {
      sessionId: true,
      reps: true,
      exercise: { select: { machineId: true } },
      session: { select: { startedAt: true } },
    },
  });

  type Agg = { cur: Set<string>; prev: Set<string>; reps: number };
  const agg = new Map<string, Agg>();
  for (const m of machines) agg.set(m.id, { cur: new Set(), prev: new Set(), reps: 0 });

  for (const e of entries) {
    const mId = e.exercise.machineId;
    if (!mId) continue;
    const a = agg.get(mId);
    if (!a) continue;
    if (e.session.startedAt >= currentStart) {
      a.cur.add(e.sessionId);
      a.reps += e.reps;
    } else {
      a.prev.add(e.sessionId);
    }
  }

  return machines
    .map((m) => {
      const a = agg.get(m.id)!;
      const cur = a.cur.size;
      const prev = a.prev.size;
      const trendPct = prev === 0 ? (cur === 0 ? 0 : null) : Math.round(((cur - prev) / prev) * 100);
      return { id: m.id, name: m.name, sessions: cur, totalReps: a.reps, trendPct };
    })
    .sort((a, b) => b.sessions - a.sessions);
}

export function getMachineInsights(
  tenantId: string,
  periodDays: number,
  scope: LocationScope
): Promise<MachineInsightRow[]> {
  // Scope verplicht in de keyParts (zie getDashboardStats).
  return unstable_cache(
    () => computeInsights(tenantId, periodDays, scope),
    ["owner-insights", tenantId, String(periodDays), scopeCacheKey(scope)],
    { revalidate: 300 }
  )();
}
