// Nederlandse curatie-laag over de RepDB-voorbeeldschema's (LibraryWorkoutTemplate).
// Puur, géén `server-only` — ook client-bruikbaar en testbaar (idioom
// lib/schema-image.ts, lib/member-day-templates.ts).
//
// **WAAROM CODE EN GEEN KOLOM.** De bundel wordt periodiek opnieuw geïmporteerd
// (`npm run library:import`) met een upsert die `names` en `descriptions` in hun
// geheel overschrijft — er is geen keep-nl-bescherming zoals `namesJsonKeepNl`
// bij de lookups en geen `origin`-veld zoals bij `LibraryExerciseText`. Een
// Nederlandse naam in de tabel zou dus precies één import overleven. Dit is
// bovendien ónze curatie, geen dataset-inhoud, net als LIBRARY_TEMPLATE_PHOTOS.
//
// **WAT DEZE LAAG REPAREERT** (bevindingen uit de catalogus-audit):
//   1. De bundel levert alleen de/en/es. `pickJsonName(names, ["nl","en"])` viel
//      dus altijd terug op Engels, midden in een verder Nederlandse catalogus.
//      Die naam wordt bij overnemen bovendien hard in het schema van het lid
//      geschreven en duikt daarna op in Mijn schema's, de PDF en het
//      coach-overzicht.
//   2. Elf van de vijftien namen bevatten een gedachtestreepje (huisstijl).
//   3. Namen telden trainingen per week terwijl de kaart trainingsdagen telt:
//      "Push / Pull / Legs — 6 Day Intermediate" toont "3 dagen". Inhoudelijk
//      klopt dat (drie dagen, twee rondes per week), maar het woord "dag" stond
//      op één kaart voor twee verschillende dingen. Opgelost in de tekst.
//   4. Twee namen beloofden een meerweeks traject ("8 Week", "0 to 10") dat
//      nergens in de data zit: het is één trainingsdag.
//   5. `home-bodyweight-beginner` heet "No Equipment" maar schrijft een barbell
//      squat voor. Dat is een fout in de bundel; `swap` corrigeert 'm.
//   6. Vier rijen zijn duplicaten van een rijker Nederlands dag-template en
//      staan daarom op `hidden`.

export type LibraryTemplateNl = {
  slug: string;
  /** Nederlandse schemanaam; vervangt de dataset-naam in de UI én bij overnemen. */
  name: string;
  /** Eén Nederlandse zin, sporter-gericht. */
  description: string;
  /** Nederlandse dagnamen, op volgorde. Ontbreekt een positie, dan wint de dataset. */
  dayNames?: string[];
  /**
   * Correctie op een oefening-slug uit de bundel (datafout). Toegepast bij
   * zowel de detailweergave als het overnemen, zodat wat je ziet is wat je krijgt.
   */
  swap?: Record<string, string>;
  /**
   * Verberg deze rij in de lid-catalogus. Alleen voor rijen die inhoudelijk al
   * gedekt worden door een gecureerd dag-template; de owner-import
   * (/owner/schemas/templates) blijft ze gewoon tonen.
   */
  hidden?: boolean;
  /** Waarom verborgen — puur documentatie. */
  hiddenReason?: string;
};

export const LIBRARY_TEMPLATE_NL: Record<string, LibraryTemplateNl> = {
  // --- Echte meerdaagse programma's ----------------------------------------
  "upper-lower-4-day": {
    slug: "upper-lower-4-day",
    name: "Upper lower split, 4 dagen",
    description:
      "Vier trainingen per week: twee keer bovenlichaam en twee keer onderlichaam, voor als je de basis beheerst.",
    dayNames: ["Bovenlichaam A", "Onderlichaam A", "Bovenlichaam B", "Onderlichaam B"],
  },
  "powerlifting-peaking-4-day": {
    slug: "powerlifting-peaking-4-day",
    name: "Powerlifting, 4 dagen",
    description:
      "Vier dagen rond squat, bench press, deadlift en overhead press, elk met zware triples vooraan.",
    dayNames: ["Squat", "Bench press", "Deadlift", "Overhead press"],
  },
  // Naam telde de trainingen per week (6), de kaart de trainingsdagen (3).
  "ppl-6-day-intermediate": {
    slug: "ppl-6-day-intermediate",
    name: "Push pull legs, 6x per week",
    description: "Drie trainingsdagen die je twee keer per week doorloopt: duwen, trekken en benen.",
    dayNames: ["Push", "Pull", "Benen"],
  },
  "stronglifts-5x5": {
    slug: "stronglifts-5x5",
    name: "5x5 kracht, 3x per week",
    description:
      "Twee trainingen die je om en om doet, drie keer per week, met elke keer iets meer gewicht op de stang.",
    dayNames: ["Training A", "Training B"],
  },
  // Heette "3 Day" terwijl er twee trainingen in zitten die je 3x per week afwisselt.
  "full-body-3-day-beginner": {
    slug: "full-body-3-day-beginner",
    name: "Full body beginner, 3x per week",
    description: "Twee eenvoudige barbell-trainingen die je om en om doet, drie keer per week.",
    dayNames: ["Training A", "Training B"],
  },
  "glutes-focus": {
    slug: "glutes-focus",
    name: "Bilspieren, 3x per week",
    description: "Twee trainingen om en om: een zware rond de hip thrust en een met meer volume.",
    dayNames: ["Zwaar heupscharnier", "Volume en activatie"],
  },

  // --- Eendaagse rijen: losse trainingen, geen programma --------------------
  // "8 Week" en "0 to 10" beloofden een opbouwtraject dat niet in de data zit.
  "push-up-progression": {
    slug: "push-up-progression",
    name: "Opbouw naar de push-up",
    description:
      "Van push-ups tegen een verhoging naar de volledige push-up op de grond, herhaal drie keer per week.",
    dayNames: ["Duwdag"],
  },
  "pull-up-progression": {
    slug: "pull-up-progression",
    name: "Opbouw naar de pull-up",
    description:
      "Van hangen aan de stang via negatives naar je eerste pull-up, herhaal drie keer per week.",
    dayNames: ["Trekdag"],
  },
  "kettlebell-complex": {
    slug: "kettlebell-complex",
    name: "Kettlebell complex, 30 min",
    description: "Vijf rondes van vijf kettlebell-oefeningen achter elkaar, met één bel.",
    dayNames: ["Complex, 5 rondes"],
  },
  "dumbbell-travel-30min": {
    slug: "dumbbell-travel-30min",
    name: "Onderweg met dumbbells",
    description: "Een half uur full body voor als je op reis bent en alleen dumbbells hebt.",
    dayNames: ["Reistraining"],
  },
  // Datafout in de bundel: een "No Equipment"-training met een barbell squat.
  "home-bodyweight-beginner": {
    slug: "home-bodyweight-beginner",
    name: "Thuis zonder apparaten",
    description: "Een complete training met alleen je eigen lichaamsgewicht, overal te doen.",
    dayNames: ["Full body"],
    swap: { squat: "bodyweight-squat" },
  },

  // --- Verborgen: al gedekt door een rijker Nederlands dag-template ---------
  "core-finisher-10min": {
    slug: "core-finisher-10min",
    name: "Core afsluiter, 10 min",
    description: "Tien minuten rompwerk om je training mee af te sluiten.",
    dayNames: ["Core circuit"],
    hidden: true,
    hiddenReason:
      "Set voor set identiek aan dag-template core-15 (Core 15 min), maar dan zonder Nederlandse notities.",
  },
  "mobility-warm-up-10min": {
    slug: "mobility-warm-up-10min",
    name: "Mobiliteit voor je training",
    description: "Tien minuten losmaken voordat je met gewicht aan de slag gaat.",
    dayNames: ["Mobiliteitsflow"],
    hidden: true,
    hiddenReason:
      "Dezelfde vijf oefeningen als dag-template mobiliteit-20, dat er een plank aan toevoegt.",
  },
  "hiit-cardio-20min": {
    slug: "hiit-cardio-20min",
    name: "HIIT cardio, 20 min",
    description: "Korte, intensieve blokken met burpees, touwtjespringen en box jumps.",
    dayNames: ["HIIT-ronde"],
    hidden: true,
    hiddenReason:
      "Deelverzameling van dag-template hiit-30, dat dezelfde vier oefeningen plus kettlebell swings heeft.",
  },
  "dumbbell-only-full-body": {
    slug: "dumbbell-only-full-body",
    name: "Full body met dumbbells",
    description: "Het hele lichaam met alleen een stel dumbbells.",
    dayNames: ["Full body"],
    hidden: true,
    hiddenReason:
      "Overlapt voor vijf van de zes oefeningen met Onderweg met dumbbells en met dag-template vijf-basisbewegingen.",
  },
};

export function libraryTemplateNl(slug: string | null | undefined): LibraryTemplateNl | null {
  return (slug && LIBRARY_TEMPLATE_NL[slug]) || null;
}

/** Wordt deze RepDB-rij bewust verborgen in de lid-catalogus? */
export function isLibraryTemplateHidden(slug: string | null | undefined): boolean {
  return Boolean(libraryTemplateNl(slug)?.hidden);
}

/** Nederlandse dagnaam op positie `index`, of de meegegeven terugval. */
export function libraryTemplateDayName(
  slug: string | null | undefined,
  index: number,
  fallback: string
): string {
  const nl = libraryTemplateNl(slug)?.dayNames?.[index]?.trim();
  return nl || fallback;
}

/** Corrigeer een oefening-slug die in de bundel fout staat. */
export function swapLibraryExerciseSlug(
  templateSlug: string | null | undefined,
  exerciseSlug: string
): string {
  return libraryTemplateNl(templateSlug)?.swap?.[exerciseSlug] ?? exerciseSlug;
}
