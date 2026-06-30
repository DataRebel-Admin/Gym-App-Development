import "server-only";
import { redirect, unauthorized, forbidden } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

/** Vereist een ingelogde TENANT_MEMBER; retourneert de session-user met een
 *  gegarandeerd niet-null `tenantId`. Niet ingelogd → premium 401; verkeerde
 *  rol → premium 403 (app/unauthorized.tsx / app/forbidden.tsx). */
export async function requireMember() {
  const session = await auth();
  if (!session?.user) unauthorized();
  if (session.user.role !== "TENANT_MEMBER") forbidden();
  if (!session.user.tenantId) redirect("/login");
  return { ...session.user, tenantId: session.user.tenantId };
}

/** Het actief toegewezen schema van een lid (incl. dagen + oefeningen). */
export async function getAssignedSchema(memberId: string, tenantId: string) {
  const itemInclude = {
    orderBy: { order: "asc" },
    include: {
      exercise: {
        include: {
          machine: true,
          catalog: { select: { gifUrl: true, imageUrl: true } },
        },
      },
    },
  } as const;

  return prisma.assignedWorkout.findFirst({
    where: { tenantId, userId: memberId },
    include: {
      template: {
        include: {
          days: { orderBy: { order: "asc" }, include: { items: itemInclude } },
          items: itemInclude,
        },
      },
    },
  });
}

export type ExerciseSeries = {
  exerciseId: string;
  name: string;
  points: { date: string; weight: number }[];
};

export type MemberHistory = {
  sessions: { id: string; startedAt: Date; exerciseCount: number }[];
  series: ExerciseSeries[];
};

/** Sessies-overzicht + gewichtsprogressie per oefening over tijd. */
export async function getMemberHistory(
  memberId: string,
  tenantId: string
): Promise<MemberHistory> {
  const sessions = await prisma.workoutSession.findMany({
    where: { tenantId, userId: memberId },
    orderBy: { startedAt: "desc" },
    take: 20,
    select: {
      id: true,
      startedAt: true,
      performanceEntries: { select: { exerciseId: true } },
    },
  });

  const entries = await prisma.performanceEntry.findMany({
    where: { tenantId, session: { userId: memberId } },
    orderBy: { session: { startedAt: "asc" } },
    select: {
      weightKg: true,
      sessionId: true,
      session: { select: { startedAt: true } },
      exercise: { select: { id: true, name: true } },
    },
  });

  // Per oefening: max gewicht per sessie (chronologisch).
  type Acc = { name: string; perSession: Map<string, { date: Date; max: number }> };
  const byExercise = new Map<string, Acc>();
  for (const e of entries) {
    let acc = byExercise.get(e.exercise.id);
    if (!acc) {
      acc = { name: e.exercise.name, perSession: new Map() };
      byExercise.set(e.exercise.id, acc);
    }
    const pt = acc.perSession.get(e.sessionId) ?? {
      date: e.session.startedAt,
      max: 0,
    };
    pt.max = Math.max(pt.max, e.weightKg);
    acc.perSession.set(e.sessionId, pt);
  }

  const series: ExerciseSeries[] = [...byExercise.entries()]
    .map(([exerciseId, acc]) => {
      const points = [...acc.perSession.values()]
        .sort((a, b) => a.date.getTime() - b.date.getTime())
        .map((p) => ({
          date: `${p.date.getDate()}/${p.date.getMonth() + 1}`,
          weight: p.max,
        }));
      return { exerciseId, name: acc.name, points };
    })
    // alleen oefeningen met gewicht (machine-oefeningen) zijn zinvol voor een grafiek
    .filter((s) => s.points.some((p) => p.weight > 0))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    sessions: sessions.map((s) => ({
      id: s.id,
      startedAt: s.startedAt,
      exerciseCount: new Set(s.performanceEntries.map((e) => e.exerciseId)).size,
    })),
    series,
  };
}

export type ExerciseProgress = {
  name: string;
  points: { date: string; weight: number; oneRm: number }[];
  sessions: { date: Date; maxWeight: number; sets: number }[];
};

/** Progressie van één oefening voor een lid: max gewicht + geschatte 1RM per sessie. */
export async function getExerciseProgress(
  memberId: string,
  tenantId: string,
  exerciseId: string
): Promise<ExerciseProgress | null> {
  const exercise = await prisma.exercise.findFirst({
    where: { id: exerciseId, tenantId },
    select: { name: true },
  });
  if (!exercise) return null;

  const entries = await prisma.performanceEntry.findMany({
    where: { tenantId, exerciseId, session: { userId: memberId } },
    orderBy: { session: { startedAt: "asc" } },
    select: {
      reps: true,
      weightKg: true,
      sessionId: true,
      session: { select: { startedAt: true } },
    },
  });

  type S = { date: Date; maxWeight: number; bestOneRm: number; sets: number };
  const bySession = new Map<string, S>();
  for (const e of entries) {
    const s = bySession.get(e.sessionId) ?? {
      date: e.session.startedAt,
      maxWeight: 0,
      bestOneRm: 0,
      sets: 0,
    };
    s.maxWeight = Math.max(s.maxWeight, e.weightKg);
    // Epley-schatting voor 1RM.
    s.bestOneRm = Math.max(s.bestOneRm, e.weightKg * (1 + e.reps / 30));
    s.sets += 1;
    bySession.set(e.sessionId, s);
  }

  const chronological = [...bySession.values()].sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  );

  return {
    name: exercise.name,
    points: chronological.map((s) => ({
      date: `${s.date.getDate()}/${s.date.getMonth() + 1}`,
      weight: s.maxWeight,
      oneRm: Math.round(s.bestOneRm),
    })),
    sessions: [...bySession.values()]
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 20)
      .map((s) => ({ date: s.date, maxWeight: s.maxWeight, sets: s.sets })),
  };
}
