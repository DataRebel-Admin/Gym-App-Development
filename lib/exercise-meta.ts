import type { ExerciseDifficulty } from "@prisma/client";

/**
 * Gedeelde (client + server) metadata voor eigen oefeningen. Bewust géén
 * `server-only`, zodat het formulier (client component) dezelfde opties en
 * labels gebruikt als de server-actions.
 */
export const EXERCISE_DIFFICULTIES = [
  "BEGINNER",
  "GEMIDDELD",
  "GEVORDERD",
] as const satisfies readonly ExerciseDifficulty[];

export const EXERCISE_DIFFICULTY_LABELS: Record<ExerciseDifficulty, string> = {
  BEGINNER: "Beginner",
  GEMIDDELD: "Gemiddeld",
  GEVORDERD: "Gevorderd",
};
