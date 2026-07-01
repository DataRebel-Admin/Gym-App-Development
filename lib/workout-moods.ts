// Workout Mood-registry — de trainingsbeleving die een sporter met één tik kiest
// na een afgeronde training. Bron van waarheid voor emoji, label, kleur, de
// "aandacht"-vlag (voor het coach-signaal) en een score (voor het gemiddelde).
//
// Bewust GEEN `server-only`: gebruikt in de client (afrondscherm) én server
// (coach-inzicht) — net als lib/training-goals.ts / lib/exercise-types.ts.
// Nieuwe mood = één record hieronder; opslag is een String-key op WorkoutSession.

export type WorkoutMoodDef = {
  key: string;
  /** Emoji voor de one-tap keuze (max één tik, zweethanden-proof). */
  emoji: string;
  /** Korte label (NL-bron, zoals training-goals). */
  label: string;
  /** Statische Tailwind tint voor het chip/knop (geen runtime kleur). */
  tone: string;
  /** 1..5 — voedt de gemiddelde trainingsbeleving in het coach-inzicht. */
  score: number;
  /** true = telt mee voor het "zware trainingen op rij"-signaal voor de coach. */
  concern: boolean;
};

export const WORKOUT_MOODS: Record<string, WorkoutMoodDef> = {
  excellent: { key: "excellent", emoji: "😁", label: "Uitstekend", tone: "bg-emerald-50 text-emerald-600", score: 5, concern: false },
  good: { key: "good", emoji: "😊", label: "Goed", tone: "bg-teal-50 text-teal-600", score: 4, concern: false },
  okay: { key: "okay", emoji: "😐", label: "Prima", tone: "bg-sky-50 text-sky-600", score: 3, concern: false },
  hard: { key: "hard", emoji: "😓", label: "Zwaar", tone: "bg-amber-50 text-amber-600", score: 2, concern: true },
  low_energy: { key: "low_energy", emoji: "😴", label: "Weinig energie", tone: "bg-orange-50 text-orange-600", score: 2, concern: false },
  unwell: { key: "unwell", emoji: "🤕", label: "Niet lekker", tone: "bg-rose-50 text-rose-600", score: 1, concern: true },
};

/** Vaste volgorde (best → zwaarst) voor de keuze-rij en trend-weergave. */
export const WORKOUT_MOOD_KEYS = Object.keys(WORKOUT_MOODS) as [string, ...string[]];

export function getMood(key: string | null | undefined): WorkoutMoodDef | null {
  return (key && WORKOUT_MOODS[key]) || null;
}

export function isMood(key: string | null | undefined): key is string {
  return Boolean(key && key in WORKOUT_MOODS);
}

/** Registry-volgorde als lijst (voor de keuze-rij). */
export function moodOptions(): WorkoutMoodDef[] {
  return WORKOUT_MOOD_KEYS.map((k) => WORKOUT_MOODS[k]);
}
