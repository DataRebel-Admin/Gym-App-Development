import "server-only";
import { prisma } from "@/lib/db";
import type { Locale } from "@prisma/client";

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

export type ExerciseDetail = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  gifUrl: string | null;
  /** Stappen in de gekozen taal (leeg als er geen stappen zijn). */
  steps: string[];
  /** Instructie als lopende tekst (fallback wanneer er geen stappen zijn). */
  instructionsText: string | null;
  primaryMuscle: string | null;
  secondaryMuscles: string[];
  equipment: string | null;
  bodyPart: string | null;
  /** Taalcode waaruit de instructie komt (bv. "nl" of "en") — null als er geen is. */
  instructionLang: string | null;
  /** Of de gegevens uit de globale catalogus komen. */
  fromCatalog: boolean;
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

  return {
    id: ex.id,
    name: ex.name?.trim() || cat?.name || "Oefening",
    description: ex.description ?? null,
    imageUrl: cat?.imageUrl ?? null,
    gifUrl: cat?.gifUrl ?? null,
    steps: steps?.value ?? [],
    instructionsText: text?.value ?? null,
    primaryMuscle: ex.targetMuscle?.trim() || cat?.target || cat?.muscleGroup || null,
    secondaryMuscles: cat?.secondaryMuscles ?? [],
    equipment: cat?.equipment ?? null,
    bodyPart: cat?.bodyPart ?? null,
    instructionLang: steps?.lang ?? text?.lang ?? null,
    fromCatalog: Boolean(cat),
  };
}
