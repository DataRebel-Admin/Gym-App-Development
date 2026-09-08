// Gecureerde dag-templates voor de lid-template-catalogus: één complete,
// ingevulde trainingsdag (Push-dag, HIIT 30 min, ...) die een lid als los
// schema kan starten of als extra dag aan een eigen schema kan toevoegen.
// Code-registry, géén `server-only` (idioom lib/member-schema-blueprints.ts,
// lib/schema-image.ts): dit is ónze curatie, versiebeheerd in git.
//
// Oefeningen verwijzen met **RepDB-slugs** (LibraryExercise.id) — er is dus
// geen tenant-Exercise nodig vóór het kopieermoment. Bij het overnemen maakt
// `ensureLibraryExercises` (lib/library-exercise-sync.ts) ontbrekende
// oefeningen aan, exact zoals de owner-import van voorbeeldschema's. Onbekende
// slugs (bv. geretireerd in een volgende bundel) worden bij overname stil
// overgeslagen; de detailweergave toont wat er écht overgenomen wordt.
//
// Nieuw dag-template = één record hieronder. Reps-notatie is de RepDB-vorm
// ("10", "8-12", "AMRAP", "30s", "10/leg") en wordt bij overname geparst met
// `parseTemplateReps` (lib/exercise-library/mapping.ts) — de notatie zelf
// blijft als item-notitie leesbaar voor het lid.

export type MemberDayTemplateItem = {
  /** RepDB-slug (LibraryExercise.id). */
  slug: string;
  sets: number;
  /** RepDB-reps-notatie: "10", "8-12", "AMRAP", "30s", "10/leg". */
  reps: string;
  restSeconds: number;
  notes?: string;
};

export type MemberDayTemplate = {
  key: string;
  /** Naam van de dag; wordt ook de dagnaam en (als los schema) de schemanaam. */
  name: string;
  description: string;
  /** Trainingsdoelen (keys uit lib/training-goals.ts) voor sortering + filter. */
  goals: string[];
  /** Badge-keys (lib/schema-badges.ts). */
  badges: string[];
  /** Duurindicatie in minuten. */
  minutes: number;
  /** Cover: key in LIBRARY_TEMPLATE_PHOTOS (lib/schema-image.ts) — hergebruik
   *  van bestaande, al geüploade omslagfoto's; geen nieuwe assets nodig. */
  photoSlug: string;
  items: MemberDayTemplateItem[];
};

export const MEMBER_DAY_TEMPLATES: MemberDayTemplate[] = [
  {
    key: "push-dag",
    name: "Push-dag",
    description: "Borst, schouders en triceps: alle duwende oefeningen op één dag.",
    goals: ["muscle", "strength"],
    badges: ["muscle"],
    minutes: 60,
    photoSlug: "ppl-6-day-intermediate",
    items: [
      { slug: "bench-press", sets: 4, reps: "6-8", restSeconds: 150 },
      { slug: "incline-db-press", sets: 3, reps: "8-10", restSeconds: 120 },
      { slug: "ohp", sets: 3, reps: "6-8", restSeconds: 120 },
      { slug: "lateral-raise", sets: 3, reps: "12-15", restSeconds: 60 },
      { slug: "tricep-pushdown", sets: 3, reps: "10-12", restSeconds: 60 },
      { slug: "skull-crusher", sets: 3, reps: "10-12", restSeconds: 60 },
    ],
  },
  {
    key: "pull-dag",
    name: "Pull-dag",
    description: "Rug en biceps: alle trekkende oefeningen op één dag.",
    goals: ["muscle", "strength"],
    badges: ["muscle"],
    minutes: 60,
    photoSlug: "pull-up-progression",
    items: [
      { slug: "deadlift", sets: 3, reps: "5", restSeconds: 180 },
      { slug: "pull-up", sets: 4, reps: "AMRAP", restSeconds: 120 },
      { slug: "barbell-row", sets: 3, reps: "8", restSeconds: 120 },
      { slug: "face-pull", sets: 3, reps: "12-15", restSeconds: 60 },
      { slug: "barbell-curl", sets: 3, reps: "10", restSeconds: 60 },
      { slug: "hammer-curl", sets: 3, reps: "10-12", restSeconds: 60 },
    ],
  },
  {
    key: "beendag",
    name: "Beendag",
    description: "Complete onderlichaam-training: quadriceps, hamstrings, billen en kuiten.",
    goals: ["muscle", "strength"],
    badges: ["muscle"],
    minutes: 60,
    photoSlug: "stronglifts-5x5",
    items: [
      { slug: "squat", sets: 4, reps: "6-8", restSeconds: 180 },
      { slug: "romanian-deadlift", sets: 3, reps: "8-10", restSeconds: 120 },
      { slug: "leg-press", sets: 3, reps: "10-12", restSeconds: 120 },
      { slug: "bulgarian-split-squat", sets: 3, reps: "10/leg", restSeconds: 90 },
      { slug: "standing-calf-raise", sets: 4, reps: "12-15", restSeconds: 60 },
      { slug: "hanging-leg-raise", sets: 3, reps: "10-15", restSeconds: 60 },
    ],
  },
  {
    key: "upper-dag",
    name: "Bovenlichaam",
    description: "Duwen en trekken gecombineerd: één complete dag voor het hele bovenlichaam.",
    goals: ["muscle", "strength"],
    badges: ["muscle"],
    minutes: 60,
    photoSlug: "upper-lower-4-day",
    items: [
      { slug: "bench-press", sets: 4, reps: "6-8", restSeconds: 150 },
      { slug: "barbell-row", sets: 4, reps: "6-8", restSeconds: 150 },
      { slug: "ohp", sets: 3, reps: "8", restSeconds: 120 },
      { slug: "pull-up", sets: 3, reps: "AMRAP", restSeconds: 120 },
      { slug: "barbell-curl", sets: 3, reps: "10-12", restSeconds: 60 },
      { slug: "tricep-pushdown", sets: 3, reps: "10-12", restSeconds: 60 },
    ],
  },
  {
    key: "fullbody-45",
    name: "Full body 45 min",
    description: "Het hele lichaam in drie kwartier, ideaal als je 2 of 3 keer per week traint.",
    goals: ["muscle", "health", "strength"],
    badges: ["beginner"],
    minutes: 45,
    photoSlug: "full-body-3-day-beginner",
    items: [
      { slug: "squat", sets: 3, reps: "8", restSeconds: 120 },
      { slug: "bench-press", sets: 3, reps: "8", restSeconds: 120 },
      { slug: "barbell-row", sets: 3, reps: "8", restSeconds: 120 },
      { slug: "dumbbell-shoulder-press", sets: 3, reps: "10", restSeconds: 90 },
      { slug: "romanian-deadlift", sets: 3, reps: "10", restSeconds: 120 },
      { slug: "plank", sets: 3, reps: "45s", restSeconds: 60 },
    ],
  },
  {
    key: "hiit-30",
    name: "HIIT 30 min",
    description: "Korte, intensieve intervallen: maximale conditie-prikkel in een half uur.",
    goals: ["conditioning", "fat_loss"],
    badges: ["intense", "conditioning"],
    minutes: 30,
    photoSlug: "hiit-cardio-20min",
    items: [
      { slug: "burpees", sets: 5, reps: "30s", restSeconds: 30 },
      { slug: "jump-rope", sets: 5, reps: "30s", restSeconds: 30 },
      { slug: "box-jump", sets: 5, reps: "30s", restSeconds: 30 },
      { slug: "battle-ropes", sets: 5, reps: "30s", restSeconds: 30 },
      { slug: "kettlebell-swing", sets: 5, reps: "15", restSeconds: 45 },
      { slug: "plank", sets: 1, reps: "AMRAP", restSeconds: 0 },
    ],
  },
  {
    key: "core-15",
    name: "Core 15 min",
    description: "Een kort maar compleet rompcircuit, ook goed als afsluiter na je training.",
    goals: ["stability", "muscle"],
    badges: [],
    minutes: 15,
    photoSlug: "core-finisher-10min",
    items: [
      { slug: "plank", sets: 3, reps: "45s", restSeconds: 30 },
      { slug: "bicycle-crunch", sets: 3, reps: "20", restSeconds: 30 },
      { slug: "russian-twist", sets: 3, reps: "20", restSeconds: 30 },
      { slug: "hanging-leg-raise", sets: 3, reps: "10-15", restSeconds: 30 },
      { slug: "bird-dog-hold", sets: 3, reps: "8/side", restSeconds: 30 },
    ],
  },
  {
    key: "mobiliteit-20",
    name: "Mobiliteit 20 min",
    description: "Rustige mobiliteits- en stabiliteitsoefeningen, ook geschikt als hersteldag.",
    goals: ["mobility", "rehab", "health"],
    badges: ["mobility"],
    minutes: 20,
    photoSlug: "mobility-warm-up-10min",
    items: [
      { slug: "dead-hang", sets: 2, reps: "30s", restSeconds: 30 },
      { slug: "scapular-pull-ups", sets: 2, reps: "8", restSeconds: 30 },
      { slug: "band-pull-apart", sets: 2, reps: "15", restSeconds: 30 },
      { slug: "dumbbell-windmill", sets: 2, reps: "5/side", restSeconds: 30 },
      { slug: "bird-dog-hold", sets: 2, reps: "8/side", restSeconds: 30 },
      { slug: "plank", sets: 2, reps: "30s", restSeconds: 30 },
    ],
  },
];

export function getMemberDayTemplate(key: string): MemberDayTemplate | undefined {
  return MEMBER_DAY_TEMPLATES.find((t) => t.key === key);
}

/** Alle RepDB-slugs van een dag-template (voor ensure/preview). */
export function dayTemplateSlugs(template: MemberDayTemplate): string[] {
  return [...new Set(template.items.map((i) => i.slug))];
}
