import "server-only";
import { forbidden } from "next/navigation";
import type { MemberSchemaMode } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { FrameworkLimits } from "@/lib/member-schema-constraints";

/**
 * Serverlogica voor zelf-gebouwde lid-schema's. Bouwt voort op requireMember()
 * (lib/member.ts) en de bestaande WorkoutTemplate/AssignedWorkout-structuren.
 * Tenant-isolatie loopt via expliciete tenantId-filters (+ RLS-backstop).
 */

/** Beschikbare oefening voor de lid-builder (mobile picker + preview). */
export type MemberExercise = {
  id: string;
  name: string;
  targetMuscle: string | null;
  exerciseType: string;
  source: "standaard" | "eigen";
  thumbUrl: string | null;
  machineName: string | null;
};

/** Lees de controle-modus van de sportschool. */
export async function getMemberSchemaMode(tenantId: string): Promise<MemberSchemaMode> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { memberSchemaMode: true },
  });
  return tenant?.memberSchemaMode ?? "DISABLED";
}

/**
 * Guard: de functie "zelf schema samenstellen" moet aan staan voor deze tenant.
 * DISABLED → premium 403. Retourneert de actieve modus.
 */
export async function requireMemberSchemaEnabled(tenantId: string): Promise<MemberSchemaMode> {
  const mode = await getMemberSchemaMode(tenantId);
  if (mode === "DISABLED") forbidden();
  return mode;
}

const itemInclude = {
  orderBy: { order: "asc" },
  include: {
    exercise: {
      include: {
        machine: { select: { name: true } },
        catalog: { select: { imageUrl: true, gifUrl: true } },
      },
    },
  },
} as const;

/**
 * Alle zelf-gebouwde schema's van een lid (origin=MEMBER), nieuwste eerst — voor
 * het "Mijn schema's"-overzicht.
 */
export async function getMemberSchemas(memberId: string, tenantId: string) {
  return prisma.assignedWorkout.findMany({
    where: { tenantId, userId: memberId, origin: "MEMBER" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      memberStatus: true,
      goal: true,
      focusNote: true,
      reviewNote: true,
      submittedAt: true,
      reviewedAt: true,
      createdAt: true,
      publishedAt: true,
      template: {
        select: {
          name: true,
          description: true,
          _count: { select: { items: true, days: true } },
        },
      },
    },
  });
}

/**
 * Eén zelf-gebouwd schema van een lid, incl. dagen/oefeningen — voor de editor.
 * Scoped op memberId + tenantId (nooit een schema van een ander lid/tenant).
 */
export async function getMemberSchemaForEdit(id: string, memberId: string, tenantId: string) {
  return prisma.assignedWorkout.findFirst({
    where: { id, tenantId, userId: memberId, origin: "MEMBER" },
    include: {
      template: {
        include: {
          days: { orderBy: { order: "asc" }, include: { items: itemInclude } },
        },
      },
    },
  });
}

/** Beschikbare (niet-gearchiveerde) oefeningen van de tenant voor de builder-picker. */
export async function getMemberExercises(tenantId: string): Promise<MemberExercise[]> {
  const rows = await prisma.exercise.findMany({
    where: { tenantId, archivedAt: null },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      targetMuscle: true,
      catalogId: true,
      exerciseType: true,
      imageUrls: true,
      machine: { select: { name: true } },
      catalog: { select: { imageUrl: true, gifUrl: true } },
    },
  });
  return rows.map((e) => ({
    id: e.id,
    name: e.name,
    targetMuscle: e.targetMuscle,
    exerciseType: e.exerciseType,
    source: e.catalogId ? ("standaard" as const) : ("eigen" as const),
    thumbUrl: e.catalog?.imageUrl ?? e.catalog?.gifUrl ?? e.imageUrls[0] ?? null,
    machineName: e.machine?.name ?? null,
  }));
}

/** Library-templates die de owner heeft vrijgegeven als lid-startsjabloon. */
export async function getMemberVisibleTemplates(tenantId: string) {
  return prisma.workoutTemplate.findMany({
    where: { tenantId, isLibrary: true, memberVisible: true, kind: "SCHEMA" },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      goal: true,
      badges: true,
      _count: { select: { items: true, days: true } },
    },
  });
}

export type ResolvedFramework = {
  id: string;
  name: string;
  description: string | null;
  requireApproval: boolean | null;
  limits: FrameworkLimits;
} | null;

/**
 * Bepaalt het kader voor een lid: per-lid koppeling → tenant-default (isDefault)
 * → geen kader (null = vrij binnen alle tenant-oefeningen).
 */
export async function resolveFramework(
  tenantId: string,
  memberId: string
): Promise<ResolvedFramework> {
  const assignment = await prisma.memberFrameworkAssignment.findFirst({
    where: { tenantId, memberId },
    select: { framework: true },
  });
  const framework =
    assignment?.framework ??
    (await prisma.schemaFramework.findFirst({
      where: { tenantId, isDefault: true },
    }));
  if (!framework) return null;
  return {
    id: framework.id,
    name: framework.name,
    description: framework.description,
    requireApproval: framework.requireApproval,
    limits: {
      allowedExerciseIds: framework.allowedExerciseIds,
      allowedTypes: framework.allowedTypes,
      minDays: framework.minDays,
      maxDays: framework.maxDays,
      minExercisesPerDay: framework.minExercisesPerDay,
      maxExercisesPerDay: framework.maxExercisesPerDay,
      setsMin: framework.setsMin,
      setsMax: framework.setsMax,
      repsMin: framework.repsMin,
      repsMax: framework.repsMax,
      restMin: framework.restMin,
      restMax: framework.restMax,
    },
  };
}
