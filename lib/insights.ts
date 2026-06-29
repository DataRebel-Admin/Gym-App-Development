import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";

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

/** Aantal sessies per machine (op basis van distinct sessies) sinds `since`. */
async function machineSessionCounts(
  tenantId: string,
  since: Date
): Promise<Map<string, Set<string>>> {
  const entries = await prisma.performanceEntry.findMany({
    where: {
      tenantId,
      exercise: { machineId: { not: null } },
      session: { startedAt: { gte: since } },
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

export type DashboardStats = {
  activeToday: number;
  memberCount: number;
  sessionsThisWeek: number;
  machineCount: number;
  topMachines: { name: string; sessions: number }[];
  bottomMachines: { name: string; sessions: number }[];
  perWeekday: { day: string; sessies: number }[];
  perWeek: { label: string; sessies: number }[];
  recent: RecentActivity[];
};

async function computeDashboard(tenantId: string): Promise<DashboardStats> {
  const machines = await prisma.machine.findMany({
    where: { tenantId },
    select: { id: true, name: true },
  });
  const nameById = new Map(machines.map((m) => [m.id, m.name]));

  // Actieve leden vandaag.
  const activeRows = await prisma.workoutSession.findMany({
    where: { tenantId, startedAt: { gte: startOfToday() } },
    distinct: ["userId"],
    select: { userId: true },
  });

  // KPI's: ledenaantal, sessies deze week, recente activiteit.
  const [memberCount, sessionsThisWeek, recentSessions] = await Promise.all([
    prisma.user.count({ where: { tenantId, role: "TENANT_MEMBER", active: true } }),
    prisma.workoutSession.count({
      where: { tenantId, startedAt: { gte: daysAgo(7) } },
    }),
    prisma.workoutSession.findMany({
      where: { tenantId },
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

  // Top 5 deze week.
  const weekCounts = await machineSessionCounts(tenantId, daysAgo(7));
  const topMachines = [...weekCounts.entries()]
    .map(([id, set]) => ({ name: nameById.get(id) ?? "?", sessions: set.size }))
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 5);

  // Bottom 3 deze maand (incl. machines met 0 gebruik).
  const monthCounts = await machineSessionCounts(tenantId, daysAgo(30));
  const bottomMachines = machines
    .map((m) => ({ name: m.name, sessions: monthCounts.get(m.id)?.size ?? 0 }))
    .sort((a, b) => a.sessions - b.sessions)
    .slice(0, 3);

  // Sessies per weekdag (laatste 30 dagen).
  const sessions30 = await prisma.workoutSession.findMany({
    where: { tenantId, startedAt: { gte: daysAgo(30) } },
    select: { startedAt: true },
  });
  const weekdayCounts = new Array(7).fill(0);
  for (const s of sessions30) {
    weekdayCounts[(s.startedAt.getDay() + 6) % 7]++; // maandag = 0
  }
  const perWeekday = WEEKDAY_LABELS.map((day, i) => ({
    day,
    sessies: weekdayCounts[i],
  }));

  // Sessies per week (laatste 12 weken).
  const sessions84 = await prisma.workoutSession.findMany({
    where: { tenantId, startedAt: { gte: daysAgo(84) } },
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
    topMachines,
    bottomMachines,
    perWeekday,
    perWeek,
    recent,
  };
}

export function getDashboardStats(tenantId: string): Promise<DashboardStats> {
  return unstable_cache(() => computeDashboard(tenantId), ["owner-dashboard", tenantId], {
    revalidate: 300,
  })();
}

export type MachineInsightRow = {
  name: string;
  sessions: number;
  totalReps: number;
  trendPct: number | null; // t.o.v. vorige periode (sessies)
};

async function computeInsights(
  tenantId: string,
  periodDays: number
): Promise<MachineInsightRow[]> {
  const machines = await prisma.machine.findMany({
    where: { tenantId },
    select: { id: true, name: true },
  });

  const currentStart = daysAgo(periodDays);
  const prevStart = daysAgo(periodDays * 2);

  const entries = await prisma.performanceEntry.findMany({
    where: {
      tenantId,
      exercise: { machineId: { not: null } },
      session: { startedAt: { gte: prevStart } },
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
      return { name: m.name, sessions: cur, totalReps: a.reps, trendPct };
    })
    .sort((a, b) => b.sessions - a.sessions);
}

export function getMachineInsights(
  tenantId: string,
  periodDays: number
): Promise<MachineInsightRow[]> {
  return unstable_cache(
    () => computeInsights(tenantId, periodDays),
    ["owner-insights", tenantId, String(periodDays)],
    { revalidate: 300 }
  )();
}
