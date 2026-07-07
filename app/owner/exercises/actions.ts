"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/staff";
import { uploadExerciseImage } from "@/lib/blob";
import { EXERCISE_DIFFICULTIES } from "@/lib/exercise-meta";
import { suggestMachineType } from "@/lib/machine";
import { buildCatalogWhere, myEquipmentValues } from "@/lib/catalog";
import { getCatalogPreview, type CatalogPreview } from "@/lib/exercise";
import { formatExerciseName } from "@/lib/exercise-name";
import { getCurrentTenant } from "@/lib/tenant";
import {
  EXERCISE_TYPE_KEYS,
  DEFAULT_EXERCISE_TYPE,
  inferExerciseType,
  isExerciseType,
} from "@/lib/exercise-types";
import { audit } from "@/lib/audit";

const addSchema = z.object({
  catalogId: z.string().min(1),
  machineId: z.string().optional(),
});

/** Voeg een catalogus-oefening toe aan de sportschool (als tenant-Exercise). */
export async function addCatalogExerciseToGym(formData: FormData) {
  const owner = await requirePermission("exercises:manage");

  const parsed = addSchema.safeParse({
    catalogId: formData.get("catalogId"),
    machineId: formData.get("machineId") || undefined,
  });
  if (!parsed.success) return;
  const { catalogId, machineId } = parsed.data;

  const catalog = await prisma.exerciseCatalog.findUnique({
    where: { id: catalogId },
    select: { name: true, target: true, category: true, equipment: true, bodyPart: true },
  });
  if (!catalog) return;

  // Idempotent: niet nog een keer toevoegen als deze catalogus-oefening al in
  // de sportschool zit.
  const existing = await prisma.exercise.findFirst({
    where: { tenantId: owner.tenantId, catalogId },
    select: { id: true },
  });
  if (existing) {
    revalidatePath("/owner/exercises");
    return;
  }

  // Machine moet bij deze tenant horen (anders negeren we 'm).
  let validMachineId: string | null = null;
  if (machineId) {
    const machine = await prisma.machine.findFirst({
      where: { id: machineId, tenantId: owner.tenantId },
      select: { id: true },
    });
    validMachineId = machine?.id ?? null;
  }

  const displayName = formatExerciseName(catalog.name);
  const created = await prisma.exercise.create({
    data: {
      tenantId: owner.tenantId,
      name: displayName,
      targetMuscle: catalog.target,
      catalogId,
      machineId: validMachineId,
      exerciseType: inferExerciseType(catalog),
    },
  });

  await audit("exercise.add", {
    actor: owner,
    tenantId: owner.tenantId,
    targetType: "Exercise",
    targetId: created.id,
    metadata: { name: displayName },
  });

  revalidatePath("/owner/exercises");
}

/**
 * Haal de detail-preview van één catalogus-oefening op (gif, spiergroepen,
 * instructies in de tenant-taal) voor de detail-modal in de catalogus-grid.
 * Gescoped achter `exercises:manage`; de catalogus is globaal (geen tenantId).
 */
export async function catalogPreview(
  catalogId: string
): Promise<CatalogPreview | null> {
  await requirePermission("exercises:manage");
  if (!catalogId) return null;
  const tenant = await getCurrentTenant();
  return getCatalogPreview(catalogId, tenant?.locale ?? "NL");
}

const bulkAddSchema = z.object({
  catalogIds: z.array(z.string().min(1)).max(5000).optional(),
  allMatchingFilter: z.boolean().optional(),
  filter: z
    .object({
      q: z.string().optional(),
      bodyPart: z.string().optional(),
      equipment: z.string().optional(),
      target: z.string().optional(),
      onlyMyEquipment: z.boolean().optional(),
    })
    .optional(),
  autoMachine: z.boolean().optional(),
});

export type BulkAddCatalogInput = z.infer<typeof bulkAddSchema>;
export type BulkAddCatalogResult = { added: number; skipped: number };

/**
 * Voeg meerdere catalogus-oefeningen tegelijk toe aan de sportschool. Twee
 * modi: een expliciete `catalogIds`-lijst (selectie op de pagina) óf
 * `allMatchingFilter` (alle resultaten van het huidige filter, ook over
 * pagina's heen). Reeds-toegevoegde worden overgeslagen (geen unique op
 * (tenantId, catalogId) → expliciet pre-filteren). Optioneel auto-koppelen aan
 * een passende machine. Batched insert; één foute rij blokkeert de rest niet.
 */
export async function bulkAddCatalogToGym(
  input: BulkAddCatalogInput
): Promise<BulkAddCatalogResult> {
  const owner = await requirePermission("exercises:manage");
  const parsed = bulkAddSchema.safeParse(input);
  if (!parsed.success) return { added: 0, skipped: 0 };
  const { catalogIds, allMatchingFilter, filter, autoMachine } = parsed.data;

  // 1) Bepaal de doel-catalogus-ids.
  let ids: string[];
  if (allMatchingFilter && filter) {
    const myEquipment = filter.onlyMyEquipment
      ? await myEquipmentValues(owner.tenantId)
      : null;
    const rows = await prisma.exerciseCatalog.findMany({
      where: buildCatalogWhere(filter, myEquipment),
      select: { id: true },
      take: 5000,
    });
    ids = rows.map((r) => r.id);
  } else {
    ids = [...new Set(catalogIds ?? [])].slice(0, 5000);
  }
  if (ids.length === 0) return { added: 0, skipped: 0 };

  // 2) Reeds in de sportschool? Overslaan.
  const existing = await prisma.exercise.findMany({
    where: { tenantId: owner.tenantId, catalogId: { in: ids } },
    select: { catalogId: true },
  });
  const existingSet = new Set(existing.map((e) => e.catalogId));
  const toAddIds = ids.filter((id) => !existingSet.has(id));
  const skipped = ids.length - toAddIds.length;
  if (toAddIds.length === 0) {
    revalidatePath("/owner/exercises");
    return { added: 0, skipped };
  }

  // 3) Catalogus-velden + optionele machine-koppeling.
  const catalogRows = await prisma.exerciseCatalog.findMany({
    where: { id: { in: toAddIds } },
    select: {
      id: true, name: true, target: true, equipment: true,
      category: true, bodyPart: true,
    },
  });

  const machineByType = new Map<string, string>();
  if (autoMachine) {
    const machines = await prisma.machine.findMany({
      where: { tenantId: owner.tenantId },
      select: { id: true, type: true },
    });
    for (const m of machines) {
      if (!machineByType.has(m.type)) machineByType.set(m.type, m.id);
    }
  }

  const data = catalogRows.map((c) => ({
    tenantId: owner.tenantId,
    name: c.name,
    targetMuscle: c.target,
    catalogId: c.id,
    exerciseType: inferExerciseType(c),
    machineId: autoMachine
      ? machineByType.get(suggestMachineType(c.equipment)) ?? null
      : null,
  }));

  // 4) Batched insert (createMany is atomair per batch).
  let added = 0;
  const CHUNK = 500;
  for (let i = 0; i < data.length; i += CHUNK) {
    const res = await prisma.exercise.createMany({
      data: data.slice(i, i + CHUNK),
      skipDuplicates: true,
    });
    added += res.count;
  }

  await audit("exercise.import", {
    actor: owner,
    tenantId: owner.tenantId,
    targetType: "Exercise",
    metadata: { count: added, skipped },
  });

  revalidatePath("/owner/exercises");
  revalidatePath("/member/exercises");
  return { added, skipped };
}

/** Verwijder een eerder toegevoegde catalogus-oefening uit de sportschool. */
export async function removeCatalogExerciseFromGym(formData: FormData) {
  const owner = await requirePermission("exercises:manage");
  const catalogId = String(formData.get("catalogId") ?? "");
  if (!catalogId) return;

  const existing = await prisma.exercise.findFirst({
    where: { tenantId: owner.tenantId, catalogId },
    select: { id: true, name: true },
  });

  // deleteMany scoped op tenant; faalt stil als de oefening in een schema zit
  // (FK) — dat is acceptabel, de owner haalt 'm dan eerst uit het schema.
  const result = await prisma.exercise
    .deleteMany({ where: { tenantId: owner.tenantId, catalogId } })
    .catch(() => null);

  if (result && result.count > 0 && existing) {
    await audit("exercise.remove", {
      actor: owner,
      tenantId: owner.tenantId,
      targetType: "Exercise",
      targetId: existing.id,
      metadata: { name: existing.name },
    });
  }

  revalidatePath("/owner/exercises");
}

/**
 * Wijzig het oefeningstype van een (willekeurige) tenant-oefening — ook
 * catalogus-gekoppelde, zodat de owner een verkeerd ingeschatte automatische
 * type-toewijzing kan bijsturen. Gescoped op de tenant; geaudit bij wijziging.
 */
export async function setExerciseType(formData: FormData) {
  const owner = await requirePermission("exercises:manage");
  const id = String(formData.get("id") ?? "");
  const exerciseType = String(formData.get("exerciseType") ?? "");
  if (!id || !isExerciseType(exerciseType)) return;

  const existing = await prisma.exercise.findFirst({
    where: { id, tenantId: owner.tenantId },
    select: { name: true, exerciseType: true },
  });
  if (!existing || existing.exerciseType === exerciseType) return;

  await prisma.exercise.updateMany({
    where: { id, tenantId: owner.tenantId },
    data: { exerciseType },
  });

  await audit("exercise.type.change", {
    actor: owner,
    tenantId: owner.tenantId,
    targetType: "Exercise",
    targetId: id,
    oldValue: { type: existing.exerciseType },
    newValue: { type: exerciseType },
    metadata: { name: existing.name, type: exerciseType },
  });

  revalidatePath("/owner/exercises");
  revalidatePath("/member/exercises");
}

// ---------------------------------------------------------------------------
// Eigen oefeningen (tenant-Exercise zonder catalogus-koppeling): volledige CRUD.
// ---------------------------------------------------------------------------

export type CustomExerciseState = { error?: string };

const customSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Naam is verplicht"),
  exerciseType: z.enum(EXERCISE_TYPE_KEYS).optional(),
  description: z.string().trim().optional(),
  targetMuscle: z.string().trim().optional(),
  category: z.string().trim().optional(),
  difficulty: z.enum(EXERCISE_DIFFICULTIES).optional().or(z.literal("")),
  equipment: z.string().trim().optional(),
  executionMd: z.string().optional(),
  coachingTipsMd: z.string().optional(),
  commonMistakesMd: z.string().optional(),
  notesMd: z.string().optional(),
  videoUrl: z
    .string()
    .trim()
    .url("Ongeldige video-URL")
    .optional()
    .or(z.literal("")),
});

/** Splits een comma-gescheiden veld naar een opgeschoonde lijst. */
function splitList(value: FormDataEntryValue | null): string[] {
  return String(value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Behoud (bewerken) bestaande afbeeldings-URL's die de gebruiker niet wiste. */
function parseKeptImages(value: FormDataEntryValue | null): string[] {
  if (typeof value !== "string" || !value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((u): u is string => typeof u === "string")
      : [];
  } catch {
    return [];
  }
}

/**
 * Maak of werk een eigen oefening bij. Gescoped op `owner.tenantId`; bij
 * bewerken is `catalogId == null` vereist (catalogus-oefeningen kunnen niet via
 * dit pad gewijzigd worden). Redirect bij succes terug naar de Eigen-tab.
 */
export async function saveCustomExercise(
  _prev: CustomExerciseState,
  formData: FormData
): Promise<CustomExerciseState> {
  const owner = await requirePermission("exercises:manage");

  const parsed = customSchema.safeParse({
    id: formData.get("id") || undefined,
    name: formData.get("name"),
    exerciseType: formData.get("exerciseType") || undefined,
    description: formData.get("description") || undefined,
    targetMuscle: formData.get("targetMuscle") || undefined,
    category: formData.get("category") || undefined,
    difficulty: formData.get("difficulty") || "",
    equipment: formData.get("equipment") || undefined,
    executionMd: formData.get("executionMd") || undefined,
    coachingTipsMd: formData.get("coachingTipsMd") || undefined,
    commonMistakesMd: formData.get("commonMistakesMd") || undefined,
    notesMd: formData.get("notesMd") || undefined,
    videoUrl: formData.get("videoUrl") || "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ongeldige invoer" };
  }
  const data = parsed.data;

  const tenant = await prisma.tenant.findUnique({
    where: { id: owner.tenantId },
    select: { slug: true },
  });
  if (!tenant) return { error: "Tenant niet gevonden" };

  // Afbeeldingen: behouden bestaande + nieuw geüploade.
  const newFiles = formData
    .getAll("images")
    .filter((f): f is File => f instanceof File && f.size > 0);
  const uploaded: string[] = [];
  for (const file of newFiles) {
    const url = await uploadExerciseImage(file, tenant.slug);
    if (url) uploaded.push(url);
  }
  const imageUrls = [...parseKeptImages(formData.get("existingImages")), ...uploaded];

  const fields = {
    name: data.name,
    exerciseType: data.exerciseType ?? DEFAULT_EXERCISE_TYPE,
    description: data.description ?? null,
    targetMuscle: data.targetMuscle ?? null,
    muscleGroups: splitList(formData.get("muscleGroups")),
    category: data.category ?? null,
    difficulty: data.difficulty ? data.difficulty : null,
    equipment: data.equipment ?? null,
    tags: splitList(formData.get("tags")),
    executionMd: data.executionMd ?? null,
    coachingTipsMd: data.coachingTipsMd ?? null,
    commonMistakesMd: data.commonMistakesMd ?? null,
    notesMd: data.notesMd ?? null,
    imageUrls,
    videoUrl: data.videoUrl || null,
  };

  if (data.id) {
    // Update — alleen eigen (catalogId == null), gescoped op tenant.
    const result = await prisma.exercise.updateMany({
      where: { id: data.id, tenantId: owner.tenantId, catalogId: null },
      data: fields,
    });
    if (result.count === 0) return { error: "Oefening niet gevonden" };
    await audit("exercise.update", {
      actor: owner,
      tenantId: owner.tenantId,
      targetType: "Exercise",
      targetId: data.id,
      newValue: { name: data.name, type: fields.exerciseType },
      metadata: { name: data.name, type: fields.exerciseType },
    });
  } else {
    const created = await prisma.exercise.create({
      data: { tenantId: owner.tenantId, catalogId: null, ...fields },
    });
    await audit("exercise.add", {
      actor: owner,
      tenantId: owner.tenantId,
      targetType: "Exercise",
      targetId: created.id,
      metadata: { name: data.name },
    });
  }

  revalidatePath("/owner/exercises");
  revalidatePath("/member/exercises");
  redirect("/owner/exercises?tab=eigen");
}

/** Dupliceer een eigen oefening (incl. media/instructies) als nieuwe kopie. */
export async function duplicateCustomExercise(formData: FormData) {
  const owner = await requirePermission("exercises:manage");
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const src = await prisma.exercise.findFirst({
    where: { id, tenantId: owner.tenantId, catalogId: null },
  });
  if (!src) return;

  const created = await prisma.exercise.create({
    data: {
      tenantId: owner.tenantId,
      catalogId: null,
      name: `${src.name} (kopie)`,
      exerciseType: src.exerciseType,
      description: src.description,
      targetMuscle: src.targetMuscle,
      muscleGroups: src.muscleGroups,
      category: src.category,
      difficulty: src.difficulty,
      equipment: src.equipment,
      tags: src.tags,
      executionMd: src.executionMd,
      coachingTipsMd: src.coachingTipsMd,
      commonMistakesMd: src.commonMistakesMd,
      notesMd: src.notesMd,
      imageUrls: src.imageUrls,
      videoUrl: src.videoUrl,
    },
  });

  await audit("exercise.duplicate", {
    actor: owner,
    tenantId: owner.tenantId,
    targetType: "Exercise",
    targetId: created.id,
    metadata: { name: created.name },
  });

  revalidatePath("/owner/exercises");
  redirect("/owner/exercises?tab=eigen");
}

/** Archiveer of herstel een eigen oefening (soft). */
export async function setCustomExerciseArchived(formData: FormData) {
  const owner = await requirePermission("exercises:manage");
  const id = String(formData.get("id") ?? "");
  const archived = formData.get("archived") === "true";
  if (!id) return;

  const existing = await prisma.exercise.findFirst({
    where: { id, tenantId: owner.tenantId, catalogId: null },
    select: { name: true },
  });
  const result = await prisma.exercise.updateMany({
    where: { id, tenantId: owner.tenantId, catalogId: null },
    data: { archivedAt: archived ? new Date() : null },
  });

  if (result.count > 0 && existing) {
    await audit(archived ? "exercise.archive" : "exercise.unarchive", {
      actor: owner,
      tenantId: owner.tenantId,
      targetType: "Exercise",
      targetId: id,
      metadata: { name: existing.name },
    });
  }

  revalidatePath("/owner/exercises");
  revalidatePath("/member/exercises");
}

/**
 * Verwijder een eigen oefening definitief — alleen als hij nergens gebruikt
 * wordt (geen schema-item, geen trainingshistorie). Wordt hij wel gebruikt, dan
 * blokkeren we en wijzen we op archiveren (voorkomt verlies van ledenhistorie).
 */
export async function deleteCustomExercise(
  _prev: CustomExerciseState,
  formData: FormData
): Promise<CustomExerciseState> {
  const owner = await requirePermission("exercises:manage");
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Onbekende oefening" };

  const existing = await prisma.exercise.findFirst({
    where: { id, tenantId: owner.tenantId, catalogId: null },
    select: { name: true },
  });
  if (!existing) return { error: "Oefening niet gevonden" };

  const [inSchemas, inHistory] = await Promise.all([
    prisma.workoutExerciseItem.count({ where: { exerciseId: id, tenantId: owner.tenantId } }),
    prisma.performanceEntry.count({ where: { exerciseId: id, tenantId: owner.tenantId } }),
  ]);
  if (inSchemas > 0 || inHistory > 0) {
    return {
      error:
        "Deze oefening is in gebruik in een schema of trainingshistorie. Archiveer hem in plaats van verwijderen.",
    };
  }

  await prisma.exercise.deleteMany({
    where: { id, tenantId: owner.tenantId, catalogId: null },
  });
  await audit("exercise.remove", {
    actor: owner,
    tenantId: owner.tenantId,
    targetType: "Exercise",
    targetId: id,
    metadata: { name: existing.name },
  });

  revalidatePath("/owner/exercises");
  redirect("/owner/exercises?tab=eigen");
}
