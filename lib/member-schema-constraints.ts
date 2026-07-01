// Pure validatie van een zelf-gebouwd lid-schema tegen de kaders (SchemaFramework)
// die de sportschool oplegt. Géén `server-only`: de builder gebruikt dit live
// (picker filteren, grenzen tonen) én de server-action gebruikt het autoritatief
// (nooit de client vertrouwen). Bouwt voort op de oefening-param-helpers.

import { getExerciseType } from "@/lib/exercise-types";
import {
  itemColumnsFromParams,
  paramsFromInputValues,
  type InputValues,
} from "@/lib/exercise-params";

/** Beperkingen-subset van een SchemaFramework (leeg/null = geen beperking). */
export type FrameworkLimits = {
  allowedExerciseIds: string[];
  allowedTypes: string[];
  minDays: number | null;
  maxDays: number | null;
  minExercisesPerDay: number | null;
  maxExercisesPerDay: number | null;
  setsMin: number | null;
  setsMax: number | null;
  repsMin: number | null;
  repsMax: number | null;
  restMin: number | null;
  restMax: number | null;
};

/** Eén te valideren item (zoals de editor het serialiseert). */
export type ConstraintItem = {
  exerciseId: string;
  exerciseType: string;
  values: InputValues;
};
export type ConstraintDay = { items: ConstraintItem[] };

export type ValidationResult = { ok: boolean; violations: string[] };

/** Heeft dit oefeningstype een doelveld dat op de gegeven kolom mapt? */
function typeUsesColumn(typeKey: string, column: string): boolean {
  return getExerciseType(typeKey).targetFields.some((f) => f.column === column);
}

/**
 * Valideer een schema-indeling tegen de kaders. `enforceMinimums` = false tijdens
 * autosave (het lid is nog aan het opbouwen — geen minimum-blokkade), true bij
 * indienen/activeren. Retourneert leesbare NL-overtredingen.
 */
export function validateAgainstFramework(
  days: ConstraintDay[],
  limits: FrameworkLimits | null,
  opts: { enforceMinimums?: boolean } = {}
): ValidationResult {
  const violations: string[] = [];
  if (!limits) return { ok: true, violations };

  const allowedExercises =
    limits.allowedExerciseIds.length > 0 ? new Set(limits.allowedExerciseIds) : null;
  const allowedTypes = limits.allowedTypes.length > 0 ? new Set(limits.allowedTypes) : null;

  // Dag-aantal.
  if (limits.maxDays != null && days.length > limits.maxDays) {
    violations.push(`Maximaal ${limits.maxDays} ${limits.maxDays === 1 ? "dag" : "dagen"} toegestaan.`);
  }
  if (opts.enforceMinimums && limits.minDays != null && days.length < limits.minDays) {
    violations.push(`Minimaal ${limits.minDays} ${limits.minDays === 1 ? "dag" : "dagen"} vereist.`);
  }

  days.forEach((day, dayIdx) => {
    const label = `Dag ${dayIdx + 1}`;
    if (limits.maxExercisesPerDay != null && day.items.length > limits.maxExercisesPerDay) {
      violations.push(`${label}: maximaal ${limits.maxExercisesPerDay} oefeningen per dag.`);
    }
    if (
      opts.enforceMinimums &&
      limits.minExercisesPerDay != null &&
      day.items.length < limits.minExercisesPerDay
    ) {
      violations.push(`${label}: minimaal ${limits.minExercisesPerDay} oefeningen per dag.`);
    }

    for (const item of day.items) {
      if (allowedTypes && !allowedTypes.has(item.exerciseType)) {
        violations.push(`${label}: het gekozen oefeningstype is hier niet toegestaan.`);
      }
      if (allowedExercises && !allowedExercises.has(item.exerciseId)) {
        violations.push(`${label}: één of meer oefeningen vallen buiten de toegestane selectie.`);
      }

      const cols = itemColumnsFromParams(
        item.exerciseType,
        paramsFromInputValues(item.exerciseType, item.values)
      );
      if (typeUsesColumn(item.exerciseType, "sets")) {
        if (limits.setsMin != null && cols.sets < limits.setsMin)
          violations.push(`${label}: minimaal ${limits.setsMin} sets per oefening.`);
        if (limits.setsMax != null && cols.sets > limits.setsMax)
          violations.push(`${label}: maximaal ${limits.setsMax} sets per oefening.`);
      }
      if (typeUsesColumn(item.exerciseType, "reps")) {
        if (limits.repsMin != null && cols.reps < limits.repsMin)
          violations.push(`${label}: minimaal ${limits.repsMin} herhalingen per set.`);
        if (limits.repsMax != null && cols.reps > limits.repsMax)
          violations.push(`${label}: maximaal ${limits.repsMax} herhalingen per set.`);
      }
      if (typeUsesColumn(item.exerciseType, "restSeconds")) {
        if (limits.restMin != null && cols.restSeconds < limits.restMin)
          violations.push(`${label}: minimaal ${limits.restMin} sec rust.`);
        if (limits.restMax != null && cols.restSeconds > limits.restMax)
          violations.push(`${label}: maximaal ${limits.restMax} sec rust.`);
      }
    }
  });

  // Ontdubbel identieke meldingen (bv. meerdere dagen met dezelfde overtreding).
  const unique = [...new Set(violations)];
  return { ok: unique.length === 0, violations: unique };
}

/** Mag een oefening (id + type) gekozen worden binnen de kaders? (Voor de picker.) */
export function isExerciseAllowed(
  limits: FrameworkLimits | null,
  exerciseId: string,
  exerciseType: string
): boolean {
  if (!limits) return true;
  if (limits.allowedExerciseIds.length > 0 && !limits.allowedExerciseIds.includes(exerciseId))
    return false;
  if (limits.allowedTypes.length > 0 && !limits.allowedTypes.includes(exerciseType)) return false;
  return true;
}

/** Zijn er überhaupt beperkingen ingesteld? (Leeg kader → geen "kaders"-UI tonen.) */
export function hasAnyLimit(limits: FrameworkLimits | null): boolean {
  if (!limits) return false;
  return (
    limits.allowedExerciseIds.length > 0 ||
    limits.allowedTypes.length > 0 ||
    limits.minDays != null ||
    limits.maxDays != null ||
    limits.minExercisesPerDay != null ||
    limits.maxExercisesPerDay != null ||
    limits.setsMin != null ||
    limits.setsMax != null ||
    limits.repsMin != null ||
    limits.repsMax != null ||
    limits.restMin != null ||
    limits.restMax != null
  );
}

/** Korte, leesbare beschrijving van de kaders (chips in de builder). */
export function describeLimits(limits: FrameworkLimits | null): string[] {
  if (!limits) return [];
  const out: string[] = [];
  if (limits.maxDays != null) out.push(`max ${limits.maxDays} dagen`);
  if (limits.minDays != null) out.push(`min ${limits.minDays} dagen`);
  if (limits.maxExercisesPerDay != null) out.push(`max ${limits.maxExercisesPerDay} oef./dag`);
  if (limits.setsMin != null || limits.setsMax != null)
    out.push(`sets ${limits.setsMin ?? 0}–${limits.setsMax ?? "∞"}`);
  if (limits.repsMin != null || limits.repsMax != null)
    out.push(`reps ${limits.repsMin ?? 0}–${limits.repsMax ?? "∞"}`);
  if (limits.restMin != null || limits.restMax != null)
    out.push(`rust ${limits.restMin ?? 0}–${limits.restMax ?? "∞"} sec`);
  if (limits.allowedTypes.length > 0) out.push(`${limits.allowedTypes.length} type(s) toegestaan`);
  if (limits.allowedExerciseIds.length > 0)
    out.push(`beperkte oefeningenlijst (${limits.allowedExerciseIds.length})`);
  return out;
}
