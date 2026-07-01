import "server-only";
import { prisma } from "@/lib/db";
import { getAchievementDef } from "@/lib/achievements/definitions";
import { type Rarity } from "@/lib/achievements/rarity";
import { getAchievementTranslator } from "@/lib/achievements/i18n";
import { getAchievementsView } from "@/lib/achievements/evaluate";

/**
 * Coach-/medewerker-inzichten rond betrokkenheid: wie behaalde net een mijlpaal,
 * wie is bijna, langste streaks, meest actieve leden en wie al lang geen nieuwe
 * mijlpaal haalde. Bewust bounded (één sessie-query + gecapte per-lid-berekening)
 * zodat het schaalbaar blijft. Tenant-scoped; optioneel gefilterd op "mijn leden".
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const ACTIVE_WINDOW_DAYS = 120;
const STALE_DAYS = 30;
/** Max leden waarvoor de (zwaardere) "bijna behaald"-voortgang wordt berekend. */
const NEAR_CANDIDATES = 16;

export type MilestoneRow = {
  userId: string;
  name: string;
  title: string;
  rarity: Rarity;
  rarityLabel: string;
  earnedAt: Date;
};
export type ActiveRow = { userId: string; name: string; sessions: number; lastActiveAt: Date };
export type StreakRow = { userId: string; name: string; streakDays: number };
export type NearRow = {
  userId: string;
  name: string;
  title: string;
  progress: number;
  currentLabel: string;
  targetLabel: string;
};
export type StaleRow = { userId: string; name: string; lastMilestoneAt: Date | null; daysSince: number };

export type CoachEngagement = {
  recentMilestones: MilestoneRow[];
  mostActive: ActiveRow[];
  longestStreaks: StreakRow[];
  nearAchievements: NearRow[];
  staleMembers: StaleRow[];
};

function longestStreak(dayStarts: number[]): number {
  if (dayStarts.length === 0) return 0;
  const sorted = [...new Set(dayStarts)].sort((a, b) => a - b);
  let longest = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    run = sorted[i] - sorted[i - 1] === DAY_MS ? run + 1 : 1;
    if (run > longest) longest = run;
  }
  return longest;
}

function startOfDay(d: Date): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

export async function getCoachEngagement(
  tenantId: string,
  opts: { memberIds?: string[] } = {}
): Promise<CoachEngagement> {
  const userFilter = opts.memberIds ? { userId: { in: opts.memberIds } } : {};
  const windowStart = new Date(Date.now() - ACTIVE_WINDOW_DAYS * DAY_MS);

  const [recentRows, sessions, lastMilestones] = await Promise.all([
    prisma.earnedAchievement.findMany({
      where: { tenantId, ...userFilter },
      orderBy: { earnedAt: "desc" },
      take: 12,
      select: { userId: true, key: true, rarity: true, earnedAt: true, user: { select: { name: true, email: true } } },
    }),
    prisma.workoutSession.findMany({
      where: { tenantId, endedAt: { not: null }, startedAt: { gte: windowStart }, ...userFilter },
      select: { userId: true, startedAt: true, user: { select: { name: true, email: true } } },
    }),
    prisma.earnedAchievement.groupBy({
      by: ["userId"],
      where: { tenantId, ...userFilter },
      _max: { earnedAt: true },
    }),
  ]);

  // Recente mijlpalen (labels in de UI-taal van de coach).
  const tr = await getAchievementTranslator();
  const recentMilestones: MilestoneRow[] = recentRows.flatMap((r) => {
    const def = getAchievementDef(r.key);
    if (!def) return [];
    return [
      {
        userId: r.userId,
        name: r.user.name ?? r.user.email,
        title: tr.title(def.key),
        rarity: def.rarity,
        rarityLabel: tr.rarity(def.rarity),
        earnedAt: r.earnedAt,
      },
    ];
  });

  // Per-lid sessie-aggregatie (activiteit + streak).
  type Agg = { name: string; days: number[]; count: number; last: Date };
  const perUser = new Map<string, Agg>();
  for (const s of sessions) {
    let a = perUser.get(s.userId);
    if (!a) {
      a = { name: s.user.name ?? s.user.email, days: [], count: 0, last: s.startedAt };
      perUser.set(s.userId, a);
    }
    a.days.push(startOfDay(s.startedAt));
    a.count += 1;
    if (s.startedAt > a.last) a.last = s.startedAt;
  }

  const aggList = [...perUser.entries()].map(([userId, a]) => ({
    userId,
    name: a.name,
    sessions: a.count,
    lastActiveAt: a.last,
    streakDays: longestStreak(a.days),
  }));

  const mostActive: ActiveRow[] = [...aggList]
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 8)
    .map(({ userId, name, sessions, lastActiveAt }) => ({ userId, name, sessions, lastActiveAt }));

  const longestStreaks: StreakRow[] = [...aggList]
    .filter((a) => a.streakDays >= 2)
    .sort((a, b) => b.streakDays - a.streakDays)
    .slice(0, 8)
    .map(({ userId, name, streakDays }) => ({ userId, name, streakDays }));

  // Stale: actieve leden zonder recente mijlpaal.
  const lastMap = new Map(lastMilestones.map((m) => [m.userId, m._max.earnedAt]));
  const now = Date.now();
  const staleMembers: StaleRow[] = aggList
    .map((a) => {
      const lastMilestoneAt = lastMap.get(a.userId) ?? null;
      const daysSince = lastMilestoneAt
        ? Math.floor((now - lastMilestoneAt.getTime()) / DAY_MS)
        : Math.floor((now - a.lastActiveAt.getTime()) / DAY_MS) + STALE_DAYS + 1;
      return { userId: a.userId, name: a.name, lastMilestoneAt, daysSince };
    })
    .filter((s) => s.daysSince >= STALE_DAYS)
    .sort((a, b) => b.daysSince - a.daysSince)
    .slice(0, 8);

  // Bijna behaald: gecapt op de meest actieve leden (zwaardere berekening).
  const nearCandidates = [...aggList].sort((a, b) => b.sessions - a.sessions).slice(0, NEAR_CANDIDATES);
  const nearResults = await Promise.all(
    nearCandidates.map(async (c) => {
      const view = await getAchievementsView(c.userId, tenantId);
      const top = view.nextUp[0];
      if (!top || top.progress < 0.6) return null;
      return {
        userId: c.userId,
        name: c.name,
        title: top.def.title,
        progress: top.progress,
        currentLabel: top.currentLabel,
        targetLabel: top.targetLabel,
      } satisfies NearRow;
    })
  );
  const nearAchievements = nearResults
    .filter((r): r is NearRow => r !== null)
    .sort((a, b) => b.progress - a.progress)
    .slice(0, 8);

  return { recentMilestones, mostActive, longestStreaks, nearAchievements, staleMembers };
}
