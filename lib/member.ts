import "server-only";
import type { Prisma } from "@prisma/client";
import { redirect, unauthorized, forbidden } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { EXERCISE_THUMB_RELATIONS } from "@/lib/exercise-thumb";
import { isTrainableSchema } from "@/lib/schema-switch";

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

/**
 * DÉ zichtbaarheidsregel voor een toegewezen schema — één bron van waarheid voor
 * `getAssignedSchema` én de lichte checks (`hasActiveCoachSchema`). Nooit ergens
 * anders opnieuw uitschrijven: wie de poort (`availableFrom`) of het verlopen
 * (`endDate`) vergeet, laat een verborgen of verlopen schema tóch meetellen.
 */
export function activeAssignmentWhere(
  memberId: string,
  tenantId: string,
  now: Date
): Prisma.AssignedWorkoutWhereInput {
  return {
    tenantId,
    userId: memberId,
    status: "PUBLISHED",
    OR: [{ availableFrom: null }, { availableFrom: { lte: now } }],
    AND: [{ OR: [{ endDate: null }, { endDate: { gte: now } }] }],
  };
}

/**
 * Heeft dit lid een actief schema dat door een coach is toegewezen? Bepaalt of
 * "aanpassing vragen" zinvol is (een zelfgebouwd schema past het lid zelf aan,
 * en zonder schema valt er niets aan te passen). Bewust een lichte `select` —
 * dit draait in de member-layout voor het menu.
 */
export async function hasActiveCoachSchema(
  memberId: string,
  tenantId: string
): Promise<boolean> {
  const row = await prisma.assignedWorkout.findFirst({
    where: { ...activeAssignmentWhere(memberId, tenantId, new Date()), origin: "COACH" },
    select: { id: true },
  });
  return row !== null;
}

/**
 * Het actief toegewezen schema van een lid (incl. dagen + oefeningen).
 *
 * Een lid kan meerdere toewijzingen hebben (concept/gepland/actief). Zichtbaar is
 * alleen een PUBLISHED-toewijzing waarvan de beschikbaarheidspoort bereikt is
 * (`availableFrom` ≤ nu) en die nog niet verlopen is (`endDate` ≥ nu). De meest
 * recent gepubliceerde wint. Concept- en geplande schema's blijven verborgen —
 * zuiver read-time, geen achtergrondjob nodig voor zichtbaarheid.
 */
export async function getAssignedSchema(memberId: string, tenantId: string) {
  const now = new Date();
  return prisma.assignedWorkout.findFirst({
    where: activeAssignmentWhere(memberId, tenantId, now),
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    include: { template: { include: SCHEMA_TEMPLATE_INCLUDE } },
  });
}

const schemaItemInclude = {
  orderBy: { order: "asc" },
  include: {
    exercise: {
      include: {
        machine: true,
        // Bron-bewust beeld (bibliotheek → klassiek → eigen): de bibliotheek
        // is de standaardbron, dus `catalog` alléén levert bijna nooit een
        // afbeelding op. Gebruikt door het schema-overzicht en de PDF.
        ...EXERCISE_THUMB_RELATIONS,
      },
    },
  },
} as const;

/**
 * Dé include voor "een schema met dagen + oefeningen" zoals de trainingsflow
 * die leest. Gedeeld door `getAssignedSchema` (het actieve schema) en
 * `getSessionTemplate` (het schema dat een lopende sessie draait) zodat beide
 * exact dezelfde vorm opleveren.
 */
export const SCHEMA_TEMPLATE_INCLUDE = {
  days: { orderBy: { order: "asc" }, include: { items: schemaItemInclude } },
  items: schemaItemInclude,
} as const;

export type SessionTemplate = NonNullable<
  Awaited<ReturnType<typeof getAssignedSchema>>
>["template"];

/**
 * Het schema waar een sessie op draait (`WorkoutSession.templateId`), tenant-
 * gescoped. `null` als het schema inmiddels is verwijderd — de aanroeper valt
 * dan terug op het actieve schema. Bewust géén lid-check op het template: een
 * eenmalige kopie uit de catalogus heeft geen AssignedWorkout, en de sessie
 * zelf is al op (tenantId, userId) gescoped.
 */
export async function getSessionTemplate(
  tenantId: string,
  templateId: string
): Promise<SessionTemplate | null> {
  return prisma.workoutTemplate.findFirst({
    where: { id: templateId, tenantId },
    include: SCHEMA_TEMPLATE_INCLUDE,
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

/**
 * Alle schema's waar het lid naartoe kan wisselen of eenmalig op kan trainen
 * (regels in lib/schema-switch.ts), mét markering welk schema nu actief is —
 * dezelfde keuze als `getAssignedSchema`, dus de wisselpagina en de trainings-
 * flow spreken elkaar nooit tegen. Gesorteerd: actief eerst, dan meest recent.
 */
export async function getSwitchableSchemas(memberId: string, tenantId: string) {
  const now = new Date();
  const [rows, active] = await Promise.all([
    prisma.assignedWorkout.findMany({
      where: { tenantId, userId: memberId },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        origin: true,
        status: true,
        memberStatus: true,
        availableFrom: true,
        endDate: true,
        publishedAt: true,
        archivedAt: true,
        createdAt: true,
        template: {
          select: {
            id: true,
            name: true,
            description: true,
            imageUrl: true,
            libraryTemplateId: true,
            badges: true,
            days: { orderBy: { order: "asc" }, select: { id: true, name: true } },
            _count: { select: { items: true } },
          },
        },
      },
    }),
    prisma.assignedWorkout.findFirst({
      where: activeAssignmentWhere(memberId, tenantId, now),
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      select: { id: true },
    }),
  ]);
  const candidates = rows
    .filter((r) => isTrainableSchema({ ...r, hasTemplate: r.template !== null }, now))
    .map((r) => ({ ...r, isActive: r.id === active?.id }));
  return candidates.sort((a, b) => Number(b.isActive) - Number(a.isActive));
}
