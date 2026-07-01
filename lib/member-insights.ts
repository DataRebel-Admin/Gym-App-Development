import "server-only";

import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import { getMood } from "@/lib/workout-moods";
import { getFavoriteIds } from "@/lib/user-preferences";

// Coach-inzichten per lid over de trainingsbeleving (Workout Mood) en favoriete
// oefeningen. Tenant-scoped (expliciete tenantId-filters + RLS-backstop). De
// mood-aggregatie wordt kort gecachet (net als lib/insights.ts).

export type MoodTrendPoint = { mood: string; emoji: string; at: string };

export type MemberMoodInsight = {
  /** Aantal sessies met een gekozen beleving. */
  count: number;
  /** Gemiddelde belevingsscore (1..5) of null als er nog niets is. */
  averageScore: number | null;
  /** Mood-key die het dichtst bij het gemiddelde ligt (voor emoji/label). */
  averageMood: string | null;
  /** Laatst gekozen mood + moment. */
  lastMood: string | null;
  lastAt: string | null;
  /** Aantal opeenvolgende recente "aandacht"-moods (zwaar/niet lekker). */
  concernStreak: number;
  /** Verdeling per mood (registry-volgorde), alleen niet-nul. */
  distribution: { mood: string; count: number }[];
  /** Laatste ~10 belevingen, oud → nieuw (mini-trend). */
  trend: MoodTrendPoint[];
};

const LOOKBACK = 30;

async function computeMoodInsight(
  tenantId: string,
  memberId: string
): Promise<MemberMoodInsight> {
  const rows = await prisma.workoutSession.findMany({
    where: { tenantId, userId: memberId, mood: { not: null } },
    orderBy: { startedAt: "desc" },
    take: LOOKBACK,
    select: { mood: true, startedAt: true },
  });

  const empty: MemberMoodInsight = {
    count: 0,
    averageScore: null,
    averageMood: null,
    lastMood: null,
    lastAt: null,
    concernStreak: 0,
    distribution: [],
    trend: [],
  };
  if (rows.length === 0) return empty;

  // Gemiddelde score.
  let scoreSum = 0;
  let scored = 0;
  const counts = new Map<string, number>();
  for (const r of rows) {
    const def = getMood(r.mood);
    if (!def) continue;
    scoreSum += def.score;
    scored += 1;
    counts.set(def.key, (counts.get(def.key) ?? 0) + 1);
  }
  const averageScore = scored > 0 ? Math.round((scoreSum / scored) * 10) / 10 : null;

  // Mood die het dichtst bij het gemiddelde ligt (representatief emoji/label).
  let averageMood: string | null = null;
  if (averageScore != null) {
    let best = Infinity;
    for (const [key] of counts) {
      const def = getMood(key);
      if (!def) continue;
      const d = Math.abs(def.score - averageScore);
      if (d < best) {
        best = d;
        averageMood = key;
      }
    }
  }

  // Opeenvolgende recente aandacht-moods (rows is nieuw → oud).
  let concernStreak = 0;
  for (const r of rows) {
    if (getMood(r.mood)?.concern) concernStreak += 1;
    else break;
  }

  const distribution = [...counts.entries()]
    .map(([mood, count]) => ({ mood, count }))
    .sort((a, b) => b.count - a.count);

  const trend: MoodTrendPoint[] = rows
    .slice(0, 10)
    .reverse()
    .map((r) => ({
      mood: r.mood!,
      emoji: getMood(r.mood)?.emoji ?? "•",
      at: r.startedAt.toISOString(),
    }));

  return {
    count: rows.length,
    averageScore,
    averageMood,
    lastMood: rows[0].mood,
    lastAt: rows[0].startedAt.toISOString(),
    concernStreak,
    distribution,
    trend,
  };
}

/** Trainingsbeleving-inzicht van een lid (kort gecachet, per tenant+lid). */
export function getMemberMoodInsight(
  tenantId: string,
  memberId: string
): Promise<MemberMoodInsight> {
  return unstable_cache(
    () => computeMoodInsight(tenantId, memberId),
    ["member-mood", tenantId, memberId],
    { revalidate: 300 }
  )();
}

export type FavoriteExercise = { id: string; name: string };

/** Favoriete oefeningen van een lid (namen geresolved, tenant-scoped). */
export async function getMemberFavorites(
  tenantId: string,
  memberId: string
): Promise<FavoriteExercise[]> {
  const user = await prisma.user.findFirst({
    where: { id: memberId, tenantId },
    select: { preferences: true },
  });
  const ids = getFavoriteIds(user?.preferences);
  if (ids.length === 0) return [];
  const rows = await prisma.exercise.findMany({
    where: { tenantId, id: { in: ids } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return rows;
}
