import "server-only";
import { prisma } from "@/lib/db";
import type { Locale, Prisma } from "@prisma/client";

export type Difficulty = "Beginner" | "Gemiddeld" | "Gevorderd";

/**
 * Heuristische moeilijkheidsgraad op basis van materiaal/categorie. De dataset
 * heeft geen difficulty-veld; dit is een ruwe inschatting (vrije gewichten zwaarder
 * te beheersen dan machines). Nooit medisch advies — de veiligheidsmelding blijft.
 */
export function deriveDifficulty(
  equipment: string | null,
  category: string | null
): Difficulty {
  const e = (equipment ?? "").toLowerCase();
  const c = (category ?? "").toLowerCase();
  if (/body\s?weight|assisted|machine|cable|sled|leverage|smith/.test(e)) return "Beginner";
  if (/barbell|olympic|weighted/.test(e) || /powerlifting|olympic/.test(c)) return "Gevorderd";
  return "Gemiddeld";
}

/**
 * Resolver-laag tussen de tenant-`Exercise` en de globale `ExerciseCatalog`.
 *
 * De catalogus is de bron van waarheid voor media, spiergroepen en (meertalige)
 * instructies; de tenant-`Exercise` mag naam/beschrijving overschrijven (whitelabel).
 * Taalkeuze volgt `tenant.locale` met EN-fallback (de dataset heeft en/es/it/tr en
 * — waar al vertaald — nl; NL/FY vallen terug op en).
 */

const LANG_PREF: Record<Locale, string[]> = {
  NL: ["nl", "en"],
  EN: ["en", "nl"],
  FY: ["nl", "en"], // Fries: geen dataset-taal, dichtst bij nl, anders en
};

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim() !== "";
}

function isStepArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.length > 0 && v.every((s) => isNonEmptyString(s));
}

/** Kies de eerste beschikbare taal uit `pref` voor een `{ lang: value }`-map. */
function pickLang<T>(
  map: unknown,
  pref: string[],
  isValid: (v: unknown) => v is T
): { lang: string; value: T } | null {
  if (!map || typeof map !== "object") return null;
  const m = map as Record<string, unknown>;
  for (const lang of pref) {
    if (isValid(m[lang])) return { lang, value: m[lang] as T };
  }
  return null;
}

const DIFFICULTY_LABEL: Record<string, Difficulty> = {
  BEGINNER: "Beginner",
  GEMIDDELD: "Gemiddeld",
  GEVORDERD: "Gevorderd",
};

export type ExerciseDetail = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  gifUrl: string | null;
  /** Alle afbeeldingen (eigen oefeningen kunnen er meerdere hebben). */
  images: string[];
  /** Optionele videolink (YouTube/Vimeo) — alleen bij eigen oefeningen. */
  videoUrl: string | null;
  /** Stappen in de gekozen taal (leeg als er geen stappen zijn). */
  steps: string[];
  /** Instructie als lopende tekst (fallback wanneer er geen stappen zijn). */
  instructionsText: string | null;
  /** Rich-text (Markdown) velden van een eigen oefening. Null voor catalogus. */
  executionMd: string | null;
  coachingTipsMd: string | null;
  commonMistakesMd: string | null;
  notesMd: string | null;
  tags: string[];
  primaryMuscle: string | null;
  secondaryMuscles: string[];
  equipment: string | null;
  bodyPart: string | null;
  category: string | null;
  /** Moeilijkheidsgraad (expliciet voor eigen oefeningen, heuristiek voor catalogus). */
  difficulty: Difficulty;
  /** Taalcode waaruit de instructie komt (bv. "nl" of "en") — null als er geen is. */
  instructionLang: string | null;
  /** Of de gegevens uit de globale catalogus komen. */
  fromCatalog: boolean;
  /** Herkomst-label: "standaard" (catalogus) of "eigen" (tenant-oefening). */
  source: "standaard" | "eigen";
};

/** Volledige weergave-data van één tenant-oefening, verrijkt met de catalogus. */
export async function getExerciseDetail(
  exerciseId: string,
  tenantId: string,
  locale: Locale
): Promise<ExerciseDetail | null> {
  const ex = await prisma.exercise.findFirst({
    where: { id: exerciseId, tenantId },
    include: { catalog: true },
  });
  if (!ex) return null;

  const cat = ex.catalog;
  const pref = LANG_PREF[locale] ?? ["en"];

  const steps = cat ? pickLang(cat.instructionSteps, pref, isStepArray) : null;
  const text = cat ? pickLang(cat.instructions, pref, isNonEmptyString) : null;

  // Eigen oefening (geen catalogus-koppeling): de tenant-velden zijn de bron van
  // media, instructies en metadata. Catalogus-oefeningen blijven ongewijzigd.
  if (!cat) {
    const images = ex.imageUrls ?? [];
    return {
      id: ex.id,
      name: ex.name?.trim() || "Oefening",
      description: ex.description ?? null,
      imageUrl: images[0] ?? null,
      gifUrl: null,
      images,
      videoUrl: ex.videoUrl ?? null,
      steps: [],
      instructionsText: null,
      executionMd: ex.executionMd ?? null,
      coachingTipsMd: ex.coachingTipsMd ?? null,
      commonMistakesMd: ex.commonMistakesMd ?? null,
      notesMd: ex.notesMd ?? null,
      tags: ex.tags ?? [],
      primaryMuscle: ex.targetMuscle?.trim() || null,
      secondaryMuscles: ex.muscleGroups ?? [],
      equipment: ex.equipment ?? null,
      bodyPart: null,
      category: ex.category ?? null,
      difficulty: ex.difficulty
        ? DIFFICULTY_LABEL[ex.difficulty]
        : "Gemiddeld",
      instructionLang: ex.executionMd ? "nl" : null,
      fromCatalog: false,
      source: "eigen",
    };
  }

  return {
    id: ex.id,
    name: ex.name?.trim() || cat.name || "Oefening",
    description: ex.description ?? null,
    imageUrl: cat.imageUrl ?? null,
    gifUrl: cat.gifUrl ?? null,
    images: cat.imageUrl ? [cat.imageUrl] : [],
    videoUrl: null,
    steps: steps?.value ?? [],
    instructionsText: text?.value ?? null,
    executionMd: null,
    coachingTipsMd: null,
    commonMistakesMd: null,
    notesMd: null,
    tags: [],
    primaryMuscle: ex.targetMuscle?.trim() || cat.target || cat.muscleGroup || null,
    secondaryMuscles: cat.secondaryMuscles ?? [],
    equipment: cat.equipment ?? null,
    bodyPart: cat.bodyPart ?? null,
    category: cat.category ?? null,
    difficulty: deriveDifficulty(cat.equipment ?? null, cat.category ?? null),
    instructionLang: steps?.lang ?? text?.lang ?? null,
    fromCatalog: true,
    source: "standaard",
  };
}

/** Lichte weergave-data van één catalogus-oefening (nog niet als tenant-Exercise
 * toegevoegd) — voor de owner-detail-preview in de catalogus-grid. Reuse van de
 * taal-resolutie van {@link getExerciseDetail}, zonder tenant-overrides. */
export type CatalogPreview = {
  id: string;
  name: string;
  imageUrl: string | null;
  gifUrl: string | null;
  bodyPart: string | null;
  equipment: string | null;
  target: string | null;
  category: string | null;
  primaryMuscle: string | null;
  secondaryMuscles: string[];
  steps: string[];
  instructionsText: string | null;
  instructionLang: string | null;
  difficulty: Difficulty;
};

export async function getCatalogPreview(
  catalogId: string,
  locale: Locale
): Promise<CatalogPreview | null> {
  const cat = await prisma.exerciseCatalog.findUnique({ where: { id: catalogId } });
  if (!cat) return null;

  const pref = LANG_PREF[locale] ?? ["en"];
  const steps = pickLang(cat.instructionSteps, pref, isStepArray);
  const text = pickLang(cat.instructions, pref, isNonEmptyString);

  return {
    id: cat.id,
    name: cat.name,
    imageUrl: cat.imageUrl ?? null,
    gifUrl: cat.gifUrl ?? null,
    bodyPart: cat.bodyPart ?? null,
    equipment: cat.equipment ?? null,
    target: cat.target ?? null,
    category: cat.category ?? null,
    primaryMuscle: cat.target ?? cat.muscleGroup ?? null,
    secondaryMuscles: cat.secondaryMuscles ?? [],
    steps: steps?.value ?? [],
    instructionsText: text?.value ?? null,
    instructionLang: steps?.lang ?? text?.lang ?? null,
    difficulty: deriveDifficulty(cat.equipment ?? null, cat.category ?? null),
  };
}

export type ExerciseAlternative = {
  id: string;
  name: string;
  thumbUrl: string | null;
  equipment: string | null;
};

/**
 * Alternatieve oefeningen binnen dezelfde tenant die dezelfde spiergroep trainen
 * (zelfde catalogus-`target` of `muscleGroup`). Data-gedekt — géén verzonnen
 * suggesties. Eigen oefeningen zonder catalogus-koppeling vallen buiten de match.
 */
export async function getAlternativeExercises(
  tenantId: string,
  exerciseId: string,
  take = 6
): Promise<ExerciseAlternative[]> {
  const src = await prisma.exercise.findFirst({
    where: { id: exerciseId, tenantId },
    select: { catalog: { select: { target: true, muscleGroup: true } } },
  });
  const target = src?.catalog?.target ?? null;
  const muscleGroup = src?.catalog?.muscleGroup ?? null;
  if (!target && !muscleGroup) return [];

  const or: Prisma.ExerciseCatalogWhereInput[] = [];
  if (target) or.push({ target });
  if (muscleGroup) or.push({ muscleGroup });

  const others = await prisma.exercise.findMany({
    where: {
      tenantId,
      id: { not: exerciseId },
      catalog: { is: { OR: or } },
    },
    select: {
      id: true,
      name: true,
      catalog: { select: { imageUrl: true, gifUrl: true, equipment: true } },
    },
    take,
  });

  return others.map((o) => ({
    id: o.id,
    name: o.name,
    thumbUrl: o.catalog?.imageUrl ?? o.catalog?.gifUrl ?? null,
    equipment: o.catalog?.equipment ?? null,
  }));
}
