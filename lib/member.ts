import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

/** Vereist een ingelogde MEMBER; retourneert de session-user. */
export async function requireMember() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "MEMBER") redirect("/owner");
  return session.user;
}

/** Het actief toegewezen schema van een lid (incl. oefeningen). */
export async function getAssignedSchema(memberId: string, tenantId: string) {
  return prisma.assignedWorkout.findFirst({
    where: { tenantId, userId: memberId },
    include: {
      template: {
        include: {
          items: {
            orderBy: { order: "asc" },
            include: { exercise: { include: { machine: true } } },
          },
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
