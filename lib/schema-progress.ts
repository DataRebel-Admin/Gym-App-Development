import "server-only";
import { prisma } from "@/lib/db";
import { startOfWeek } from "@/lib/member-stats";

/**
 * Voortgang op het **actieve schema**, afgeleid uit echt afgeronde workouts
 * (`WorkoutSession`) — niet uit handmatig afvinken. Het lid vinkt oefeningen
 * uitsluitend af tijdens de workout zelf (`/member/schema/active`); de
 * schema-pagina toont daarom wat er daadwerkelijk gedaan is.
 *
 * Géén nieuw model: `WorkoutSession.dayId` bestaat al, dus per trainingsdag
 * weten we wanneer die voor het laatst gedraaid is. Tenant-scoped via expliciete
 * `tenantId` (zoals lib/member-stats.ts).
 */

/** Hoeveel sessies we maximaal meenemen — ruim boven een normaal schema-leven. */
const MAX_SESSIONS = 500;

export type SchemaDayProgress = {
  dayId: string;
  /** Laatste afgeronde workout op deze trainingsdag (null = nog niet gedaan). */
  lastTrainedAt: Date | null;
  /** Aantal afgeronde workouts op deze dag sinds het schema actief werd. */
  sessions: number;
  doneThisWeek: boolean;
};

export type SchemaProgress = {
  /** Aantal afgeronde workouts op dit schema. */
  totalSessions: number;
  sessionsThisWeek: number;
  lastTrainedAt: Date | null;
  /** Per trainingsdag; leeg als het schema geen dagen heeft. */
  days: SchemaDayProgress[];
  /** Aantal verschillende trainingsdagen dat deze week is afgerond. */
  daysDoneThisWeek: number;
};

/**
 * Tel de afgeronde workouts sinds `since` (= publicatiedatum van de toewijzing,
 * zodat een vorig schema niet meetelt) en verdeel ze over de trainingsdagen.
 * Een nog lopende sessie (`endedAt == null`) telt bewust niet mee: die is pas
 * voortgang zodra het lid 'm afrondt.
 */
export async function getSchemaProgress(
  memberId: string,
  tenantId: string,
  opts: { since: Date | null; dayIds: string[] }
): Promise<SchemaProgress> {
  const now = new Date();
  const weekStart = startOfWeek(now);
  const sessions = await prisma.workoutSession.findMany({
    where: {
      tenantId,
      userId: memberId,
      endedAt: { not: null },
      ...(opts.since ? { startedAt: { gte: opts.since } } : {}),
    },
    orderBy: { startedAt: "desc" },
    take: MAX_SESSIONS,
    select: { dayId: true, startedAt: true },
  });

  const perDay = new Map<string, SchemaDayProgress>();
  for (const dayId of opts.dayIds) {
    perDay.set(dayId, { dayId, lastTrainedAt: null, sessions: 0, doneThisWeek: false });
  }

  let sessionsThisWeek = 0;
  for (const s of sessions) {
    const inWeek = s.startedAt >= weekStart;
    if (inWeek) sessionsThisWeek++;
    const day = s.dayId ? perDay.get(s.dayId) : undefined;
    if (!day) continue;
    day.sessions++;
    // Sessies komen aflopend binnen → de eerste treffer is de meest recente.
    if (!day.lastTrainedAt) day.lastTrainedAt = s.startedAt;
    if (inWeek) day.doneThisWeek = true;
  }

  const days = opts.dayIds.map((id) => perDay.get(id)!);
  return {
    totalSessions: sessions.length,
    sessionsThisWeek,
    lastTrainedAt: sessions[0]?.startedAt ?? null,
    days,
    daysDoneThisWeek: days.filter((d) => d.doneThisWeek).length,
  };
}

/** Hele dagen tussen `d` en nu (0 = vandaag). `null` → null. */
export function daysAgo(d: Date | null, now: Date = new Date()): number | null {
  if (!d) return null;
  const a = new Date(d);
  a.setHours(0, 0, 0, 0);
  const b = new Date(now);
  b.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86_400_000));
}
