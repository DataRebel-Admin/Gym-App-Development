// scripts/import-library.ts
//
// Importeer de RepDB-oefeningenbundel in de bibliotheek-tabellen
// (LibraryExercise/-Text/-Muscle/-Equipment/-Relation/-WorkoutTemplate).
//
// - Bron: de PRIVÉ blob-container `exercise-source` (licentie: de ruwe bundel
//   mag niet publiek) — gelezen via AZURE_STORAGE_CONNECTION_STRING.
// - Idempotent: upsert op slug; verdwenen slugs worden ge-retired (nooit hard
//   verwijderd — gekoppelde tenant-oefeningen blijven werken), teruggekeerde
//   slugs un-retired.
// - Teksten: en/de/es uit de bundel (origin "dataset"). Rijen met origin
//   "manual"/"machine" worden NOOIT overschreven — de latere NL-vertaalronde
//   en handmatige correcties zijn daarmee re-importveilig. Vertalen gebeurt
//   hier bewust niet.
// - Media wordt NIET aangeraakt: de app bewaart relatieve keys en leest ze
//   publiek uit `exercise-media` (zie lib/exercise-library/media.ts).
//
// Gebruik: npm run library:import

import "dotenv/config";
import { BlobServiceClient } from "@azure/storage-blob";
import { PrismaClient, Prisma } from "@prisma/client";
import { inferLibraryExerciseType } from "../lib/exercise-library/mapping";

const prisma = new PrismaClient();

const CHUNK = 25;

type BundleExercise = {
  id: string;
  name_en: string;
  name_de?: string;
  name_es?: string;
  description_en?: string;
  description_de?: string;
  description_es?: string;
  instructions_en?: string[];
  instructions_de?: string[];
  instructions_es?: string[];
  tips_en?: string[];
  tips_de?: string[];
  tips_es?: string[];
  category: string;
  force_type?: string;
  mechanic?: string;
  difficulty?: string;
  body_part?: string;
  equipment?: string;
  additional_required_equipment?: string[];
  equipment_alternatives?: string[];
  primary_muscles?: string[];
  secondary_muscles?: string[];
  goals?: string[];
  tags?: string[];
  variation_group?: string;
  synonyms?: string[];
  is_unilateral?: boolean;
  is_bodyweight?: boolean;
  is_placeholder?: boolean;
  animation?: boolean;
  animation_type?: string;
  image_alias?: string;
  met?: number;
  relations?: { to: string; type: string }[];
  images?: Record<string, string[]>;
};

type Bundle = {
  schema_version: number;
  generated_at?: string;
  counts?: Record<string, number>;
  exercises: BundleExercise[];
  muscles: Record<
    string,
    {
      name_en: string;
      name_de?: string;
      name_es?: string;
      name_scientific?: string;
      region: string;
      synonyms?: string[];
      image?: string;
    }
  >;
  equipment: Record<
    string,
    {
      name_en: string;
      name_de?: string;
      name_es?: string;
      tags?: string[];
      synonyms?: string[];
      image?: string;
    }
  >;
};

type TemplateBundle = {
  schema_version: number;
  templates: {
    id: string;
    name_en: string;
    name_de?: string;
    name_es?: string;
    description_en?: string;
    description_de?: string;
    description_es?: string;
    goal: string;
    difficulty: string;
    frequency_per_week?: number;
    tags?: string[];
    days: unknown[];
  }[];
};

function env(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") {
    console.error(`✗ Ontbrekende env-variabele: ${name}`);
    process.exit(1);
  }
  return v;
}

async function downloadJson<T>(container: ReturnType<BlobServiceClient["getContainerClient"]>, name: string): Promise<T> {
  const blob = container.getBlockBlobClient(name);
  const buf = await blob.downloadToBuffer();
  return JSON.parse(buf.toString("utf8")) as T;
}

/** {en, de, es}-namen-Json zonder lege waardes. */
function namesJson(rec: { name_en: string; name_de?: string; name_es?: string }): Prisma.InputJsonValue {
  const out: Record<string, string> = { en: rec.name_en };
  if (rec.name_de?.trim()) out.de = rec.name_de;
  if (rec.name_es?.trim()) out.es = rec.name_es;
  return out;
}

/**
 * Zelfde namen-Json, maar met de **bestaande Nederlandse naam behouden**. De
 * bundel levert alleen en/de/es; `nl` is handwerk uit
 * `lib/translate/library-lookups-nl.ts` (script `library:lookups`). Zonder deze
 * merge zou elke re-import die curatie stil wegvagen — het lookup-equivalent van
 * `origin: "manual"` bij de oefeningteksten.
 */
function namesJsonKeepNl(
  rec: { name_en: string; name_de?: string; name_es?: string },
  existing: Prisma.JsonValue | undefined
): Prisma.InputJsonValue {
  const out = namesJson(rec) as Record<string, string>;
  const nl =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? (existing as Record<string, string>).nl
      : undefined;
  return nl?.trim() ? { ...out, nl } : out;
}

async function inChunks<T>(items: T[], fn: (chunk: T[]) => Promise<void>) {
  for (let i = 0; i < items.length; i += CHUNK) {
    await fn(items.slice(i, i + CHUNK));
  }
}

async function main() {
  const service = BlobServiceClient.fromConnectionString(env("AZURE_STORAGE_CONNECTION_STRING"));
  const container = service.getContainerClient(process.env.LIBRARY_SOURCE_CONTAINER || "exercise-source");

  console.log("Bundel ophalen uit privé-container…");
  const [bundle, templates, changelog] = await Promise.all([
    downloadJson<Bundle>(container, "exercises.json"),
    downloadJson<TemplateBundle>(container, "workout_templates.json"),
    container
      .getBlockBlobClient("CHANGELOG.md")
      .downloadToBuffer()
      .then((b) => b.toString("utf8"))
      .catch(() => ""),
  ]);

  // --- Validatie (licht, zonder extra deps) --------------------------------
  if (bundle.schema_version !== 3) {
    console.error(`✗ Onverwachte schema_version: ${bundle.schema_version} (verwacht 3).`);
    process.exit(1);
  }
  if (!Array.isArray(bundle.exercises) || bundle.exercises.length === 0) {
    console.error("✗ Bundel bevat geen oefeningen.");
    process.exit(1);
  }
  const counted = bundle.counts?.exercises;
  if (counted != null && counted !== bundle.exercises.length) {
    console.error(`✗ counts.exercises (${counted}) ≠ werkelijke lengte (${bundle.exercises.length}).`);
    process.exit(1);
  }
  const placeholders = bundle.exercises.filter((e) => e.is_placeholder).length;
  if (placeholders > 0) {
    console.warn(`! ${placeholders} placeholder-oefeningen — die worden wel geïmporteerd.`);
  }

  const version = /^## (v[\d.]+)/m.exec(changelog)?.[1] ?? bundle.generated_at ?? "onbekend";
  console.log(
    `Bundel: ${bundle.exercises.length} oefeningen, ${Object.keys(bundle.muscles).length} spieren, ` +
      `${Object.keys(bundle.equipment).length} materialen, ${templates.templates.length} templates — versie ${version}`
  );

  // --- Spieren & materiaal (kleine lookups) --------------------------------
  // Bestaande namen eerst inlezen: de handmatig gecureerde `nl` moet een
  // re-import overleven (zie `namesJsonKeepNl`).
  const [existingMuscles, existingEquipment] = await Promise.all([
    prisma.libraryMuscle.findMany({ select: { id: true, names: true } }),
    prisma.libraryEquipment.findMany({ select: { id: true, names: true } }),
  ]);
  const muscleNames = new Map(existingMuscles.map((m) => [m.id, m.names]));
  const equipmentNames = new Map(existingEquipment.map((e) => [e.id, e.names]));

  for (const [id, m] of Object.entries(bundle.muscles)) {
    await prisma.libraryMuscle.upsert({
      where: { id },
      create: {
        id,
        region: m.region,
        nameScientific: m.name_scientific ?? null,
        names: namesJson(m),
        synonyms: m.synonyms ?? [],
        image: m.image ?? null,
      },
      update: {
        region: m.region,
        nameScientific: m.name_scientific ?? null,
        names: namesJsonKeepNl(m, muscleNames.get(id)),
        synonyms: m.synonyms ?? [],
        image: m.image ?? null,
      },
    });
  }
  console.log(`✓ Spieren: ${Object.keys(bundle.muscles).length}`);

  for (const [id, e] of Object.entries(bundle.equipment)) {
    await prisma.libraryEquipment.upsert({
      where: { id },
      create: {
        id,
        names: namesJson(e),
        tags: e.tags ?? [],
        synonyms: e.synonyms ?? [],
        image: e.image ?? null,
      },
      update: {
        names: namesJsonKeepNl(e, equipmentNames.get(id)),
        tags: e.tags ?? [],
        synonyms: e.synonyms ?? [],
        image: e.image ?? null,
      },
    });
  }
  console.log(`✓ Materialen: ${Object.keys(bundle.equipment).length}`);

  // --- Oefeningen ----------------------------------------------------------
  const bundleIds = new Set(bundle.exercises.map((e) => e.id));
  let done = 0;
  await inChunks(bundle.exercises, async (chunk) => {
    await prisma.$transaction(
      chunk.map((ex) => {
        const data = {
          category: ex.category,
          forceType: ex.force_type ?? null,
          mechanic: ex.mechanic ?? null,
          difficulty: ex.difficulty ?? null,
          bodyPart: ex.body_part ?? null,
          equipmentSlug: ex.equipment ?? null,
          additionalEquipment: ex.additional_required_equipment ?? [],
          equipmentAlternatives: ex.equipment_alternatives ?? [],
          primaryMuscles: ex.primary_muscles ?? [],
          secondaryMuscles: ex.secondary_muscles ?? [],
          goals: ex.goals ?? [],
          tags: ex.tags ?? [],
          synonyms: ex.synonyms ?? [],
          variationGroup: ex.variation_group ?? null,
          isUnilateral: ex.is_unilateral ?? false,
          isBodyweight: ex.is_bodyweight ?? false,
          met: ex.met ?? null,
          exerciseType: inferLibraryExerciseType({
            category: ex.category,
            forceType: ex.force_type,
            bodyPart: ex.body_part,
            goals: ex.goals,
          }),
          images: (ex.images ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          animation: ex.animation ?? false,
          animationType: ex.animation_type ?? null,
          imageAlias: ex.image_alias ?? null,
          retiredAt: null, // in de bundel = actief (un-retire bij terugkeer)
          datasetVersion: version,
        };
        return prisma.libraryExercise.upsert({
          where: { id: ex.id },
          create: { id: ex.id, ...data },
          update: data,
        });
      })
    );
    done += chunk.length;
    if (done % 100 === 0 || done === bundle.exercises.length) {
      console.log(`  … oefeningen ${done}/${bundle.exercises.length}`);
    }
  });

  // --- Teksten (en/de/es) — handwerk/vertalingen nooit overschrijven -------
  const existingTexts = await prisma.libraryExerciseText.findMany({
    select: { exerciseId: true, locale: true, origin: true },
  });
  const textOrigin = new Map(existingTexts.map((t) => [`${t.exerciseId}:${t.locale}`, t.origin]));

  type TextRow = {
    exerciseId: string;
    locale: string;
    name: string;
    description: string | null;
    instructions: string[];
    tips: string[];
  };
  const textRows: TextRow[] = [];
  let skippedProtected = 0;
  for (const ex of bundle.exercises) {
    for (const locale of ["en", "de", "es"] as const) {
      const name = ex[`name_${locale}`]?.trim();
      if (!name) continue;
      const origin = textOrigin.get(`${ex.id}:${locale}`);
      if (origin && origin !== "dataset") {
        skippedProtected++;
        continue;
      }
      textRows.push({
        exerciseId: ex.id,
        locale,
        name,
        description: ex[`description_${locale}`]?.trim() || null,
        instructions: ex[`instructions_${locale}`] ?? [],
        tips: ex[`tips_${locale}`] ?? [],
      });
    }
  }
  await inChunks(textRows, async (chunk) => {
    await prisma.$transaction(
      chunk.map((row) =>
        prisma.libraryExerciseText.upsert({
          where: { exerciseId_locale: { exerciseId: row.exerciseId, locale: row.locale } },
          create: { ...row, origin: "dataset" },
          update: { ...row, origin: "dataset" },
        })
      )
    );
  });
  console.log(
    `✓ Teksten: ${textRows.length} bijgewerkt` +
      (skippedProtected > 0 ? `, ${skippedProtected} beschermd (origin ≠ dataset)` : "")
  );

  // --- Relaties (vervang-alles per bundel — idempotent) --------------------
  const relRows: { fromId: string; toId: string; type: string }[] = [];
  let danglingRels = 0;
  for (const ex of bundle.exercises) {
    for (const rel of ex.relations ?? []) {
      if (!bundleIds.has(rel.to)) {
        danglingRels++;
        continue;
      }
      relRows.push({ fromId: ex.id, toId: rel.to, type: rel.type });
    }
  }
  await prisma.$transaction([
    prisma.libraryRelation.deleteMany({}),
    prisma.libraryRelation.createMany({ data: relRows, skipDuplicates: true }),
  ]);
  console.log(
    `✓ Relaties: ${relRows.length}` +
      (danglingRels > 0 ? ` (${danglingRels} overgeslagen: doel buiten de bundel)` : "")
  );

  // --- Retire/unretire -----------------------------------------------------
  const retired = await prisma.libraryExercise.updateMany({
    where: { id: { notIn: [...bundleIds] }, retiredAt: null },
    data: { retiredAt: new Date() },
  });
  if (retired.count > 0) {
    console.log(`! ${retired.count} oefeningen ge-retired (niet meer in de bundel).`);
  }

  // --- Workout-templates ---------------------------------------------------
  if (templates.schema_version !== 1) {
    console.warn(`! workout_templates schema_version ${templates.schema_version} (verwacht 1) — import gaat door.`);
  }
  const templateIds = new Set(templates.templates.map((t) => t.id));
  for (const t of templates.templates) {
    const descriptions: Record<string, string> = {};
    if (t.description_en?.trim()) descriptions.en = t.description_en;
    if (t.description_de?.trim()) descriptions.de = t.description_de;
    if (t.description_es?.trim()) descriptions.es = t.description_es;
    const data = {
      goal: t.goal,
      difficulty: t.difficulty,
      frequencyPerWeek: t.frequency_per_week ?? null,
      tags: t.tags ?? [],
      names: namesJson(t),
      descriptions: descriptions as Prisma.InputJsonValue,
      days: t.days as Prisma.InputJsonValue,
      datasetVersion: version,
      retiredAt: null,
    };
    await prisma.libraryWorkoutTemplate.upsert({
      where: { id: t.id },
      create: { id: t.id, ...data },
      update: data,
    });
  }
  const retiredTpl = await prisma.libraryWorkoutTemplate.updateMany({
    where: { id: { notIn: [...templateIds] }, retiredAt: null },
    data: { retiredAt: new Date() },
  });
  console.log(
    `✓ Templates: ${templates.templates.length}` +
      (retiredTpl.count > 0 ? ` (${retiredTpl.count} ge-retired)` : "")
  );

  // Verwijzings-check: elke template-oefening moet bestaan in de bibliotheek.
  let danglingTplRefs = 0;
  for (const t of templates.templates) {
    for (const day of t.days as { exercises?: { exercise_id: string }[] }[]) {
      for (const ref of day.exercises ?? []) {
        if (!bundleIds.has(ref.exercise_id)) danglingTplRefs++;
      }
    }
  }
  if (danglingTplRefs > 0) {
    console.warn(`! ${danglingTplRefs} template-verwijzingen naar onbekende oefeningen.`);
  }

  const totals = await prisma.$transaction([
    prisma.libraryExercise.count({ where: { retiredAt: null } }),
    prisma.libraryExerciseText.count(),
    prisma.libraryRelation.count(),
    prisma.libraryWorkoutTemplate.count({ where: { retiredAt: null } }),
  ]);
  console.log(
    `\nKlaar (versie ${version}): ${totals[0]} actieve oefeningen, ${totals[1]} teksten, ` +
      `${totals[2]} relaties, ${totals[3]} templates.`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
