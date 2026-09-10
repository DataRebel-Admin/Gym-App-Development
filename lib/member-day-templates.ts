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
// ("10", "8-12", "AMRAP", "30s", "10/zijde") en wordt bij overname geparst met
// `parseTemplateReps` (lib/exercise-library/mapping.ts) — de notatie zelf
// blijft als item-notitie leesbaar voor het lid.
//
// **HERKOMST HOORT IN EEN CODE-COMMENTAAR, NIET IN `description`.** Bijna elk
// record hieronder komt uit een bestaand, navolgbaar programma (Starting
// Strength, de CrossFit-benchmarks, McGill Big 3, Surya Namaskar, ...). Die
// bronvermelding staat als `//`-regel bóven het record: `description` is
// sporter-gerichte UI-tekst van één zin en geen literatuurverwijzing.
//
// **TIJD SCHRIJF JE IN SECONDEN, NOOIT IN MINUTEN.** `parseTemplateReps` pakt
// het leidende getal als doelaantal herhalingen, dus `"4min"` landt als 4
// herhalingen in het schema van het lid. Schrijf `"240s"` en zet de leesbare
// duur ("vier minuten op 90 tot 95% van je maximale hartslag") in `notes`.
// Afstanden (`"400m"`, `"500m"`) zijn wél afgesproken notatie en blijven.

import type { GroupTypeKey } from "@/lib/exercise-groups";

export type MemberDayTemplateItem = {
  /** RepDB-slug (LibraryExercise.id). */
  slug: string;
  sets: number;
  /** RepDB-reps-notatie: "10", "8-12", "AMRAP", "30s", "10/zijde". */
  reps: string;
  restSeconds: number;
  notes?: string;
  /** Sleutel in `MemberDayTemplate.groups` — opeenvolgende items met dezelfde
   *  sleutel worden bij overname één superset/circuit/AMRAP. */
  group?: string;
};

/** Groep-instelling (superset/giant/circuit/AMRAP) binnen één dag-template. */
export type MemberDayTemplateGroup = {
  type: GroupTypeKey;
  /** Aantal rondes (circuit/superset/giant). AMRAP is open en gebruikt de timecap. */
  rounds?: number;
  /** Rust ná een volledige ronde, in seconden. */
  restSeconds?: number;
  /** Korte naam van de groep, bv. de naam van een benchmark-workout. */
  label?: string;
  /** Tijdslimiet voor een AMRAP, in seconden. */
  timeCapSeconds?: number;
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
  /** Niveau-indicatie voor het catalogus-filter. Weglaten = geen niveau (de
   *  rij valt dan weg zodra er op niveau gefilterd wordt). */
  level?: "beginner" | "intermediate" | "advanced";
  /** Cover: key in LIBRARY_TEMPLATE_PHOTOS (lib/schema-image.ts) — hergebruik
   *  van bestaande, al geüploade omslagfoto's; geen nieuwe assets nodig. */
  photoSlug: string;
  items: MemberDayTemplateItem[];
  /** Groep-instellingen, gekoppeld via `MemberDayTemplateItem.group`. */
  groups?: Record<string, MemberDayTemplateGroup>;
};

export const MEMBER_DAY_TEMPLATES: MemberDayTemplate[] = [
  // -------------------------------------------------------------------------
  // Kracht en spieropbouw: split-dagen
  // -------------------------------------------------------------------------
  {
    key: "push-dag",
    name: "Push-dag",
    description: "Borst, schouders en triceps: alle duwende oefeningen op één dag.",
    goals: ["muscle", "strength"],
    badges: ["muscle"],
    minutes: 60,
    level: "intermediate",
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
    level: "intermediate",
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
    level: "intermediate",
    photoSlug: "stronglifts-5x5",
    items: [
      { slug: "squat", sets: 4, reps: "6-8", restSeconds: 180 },
      { slug: "romanian-deadlift", sets: 3, reps: "8-10", restSeconds: 120 },
      { slug: "leg-press", sets: 3, reps: "10-12", restSeconds: 120 },
      { slug: "bulgarian-split-squat", sets: 3, reps: "10/zijde", restSeconds: 90 },
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
    level: "intermediate",
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
  // Signatuurdag van de Arnold split (Schwarzenegger & Dobbins, The New
  // Encyclopedia of Modern Bodybuilding). Antagonist-supersets korten de sessie
  // fors in zonder verlies aan prikkel per set (Robbins 2010, Weakley 2020).
  // Volume teruggebracht van Arnolds circa 45 werksets naar 20, tien per spiergroep.
  {
    key: "borst-rug-supersets",
    name: "Borst en rug supersets",
    description:
      "Arnold-stijl supersets: borst en rug om en om, zodat de ene spiergroep rust terwijl de andere werkt.",
    goals: ["muscle", "strength"],
    badges: ["muscle", "intense"],
    minutes: 55,
    level: "intermediate",
    photoSlug: "upper-lower-4-day",
    groups: {
      a: { type: "superset", rounds: 4, restSeconds: 150 },
      b: { type: "superset", rounds: 3, restSeconds: 120 },
      c: { type: "superset", rounds: 3, restSeconds: 90 },
    },
    items: [
      {
        slug: "bench-press",
        sets: 4,
        reps: "8-10",
        restSeconds: 30,
        notes: "Ga direct door naar de pull-up.",
        group: "a",
      },
      {
        slug: "pull-up",
        sets: 4,
        reps: "6-10",
        restSeconds: 150,
        notes: "Lukken er geen zes? Kies assisted pull-ups of negatives.",
        group: "a",
      },
      {
        slug: "incline-db-press",
        sets: 3,
        reps: "10-12",
        restSeconds: 30,
        notes: "Ga direct door naar de T-bar row.",
        group: "b",
      },
      { slug: "t-bar-row", sets: 3, reps: "10-12", restSeconds: 120, group: "b" },
      {
        slug: "cable-fly",
        sets: 3,
        reps: "12-15",
        restSeconds: 30,
        notes: "Ga direct door naar de straight-arm pulldown.",
        group: "c",
      },
      {
        slug: "straight-arm-pulldown",
        sets: 3,
        reps: "12-15",
        restSeconds: 90,
        notes: "Houd je armen bijna gestrekt en knijp je lats aan.",
        group: "c",
      },
    ],
  },
  // Klassieke schouderdag, ingevuld volgens de verhouding die Jeff Nippard en
  // Renaissance Periodization hanteren: het meeste isolatiewerk naar de
  // zijdelingse deltaspier, omdat de voorste kop al meetraint bij elke
  // drukoefening. Zeven sets zijdelings, zes achterkant, vier zwaar drukken.
  {
    key: "schouderdag",
    name: "Schouderdag",
    description:
      "Alles voor je schouders, met de nadruk op de zijkant van je deltaspier voor meer breedte.",
    goals: ["muscle", "strength"],
    badges: ["muscle"],
    minutes: 50,
    level: "intermediate",
    photoSlug: "ppl-6-day-intermediate",
    items: [
      {
        slug: "ohp",
        sets: 4,
        reps: "6-8",
        restSeconds: 150,
        notes: "Je enige zware drukoefening vandaag, bouw rustig op in gewicht.",
      },
      {
        slug: "cable-lateral-raise",
        sets: 4,
        reps: "12-15",
        restSeconds: 60,
        notes: "De kabel houdt de spanning erop, ook onderin de beweging.",
      },
      {
        slug: "lateral-raise",
        sets: 3,
        reps: "15-20",
        restSeconds: 45,
        notes: "Licht gewicht, strakke uitvoering, geen zwaai vanuit je rug.",
      },
      { slug: "rear-delt-fly", sets: 3, reps: "12-15", restSeconds: 60 },
      {
        slug: "face-pull",
        sets: 3,
        reps: "15-20",
        restSeconds: 60,
        notes: "Trek naar je voorhoofd en draai je handen naar buiten.",
      },
      { slug: "db-shrug", sets: 3, reps: "12-15", restSeconds: 60 },
    ],
  },
  // Armendag uit de bro-split en de Arnold split, waar biceps en triceps
  // standaard gesuperset werden. De overhead extension staat naast de pushdown
  // omdat de lange tricepskop daar op lengte werkt en meer groeit (Maeo 2023).
  {
    key: "armendag",
    name: "Armendag",
    description:
      "Biceps en triceps in supersets, van een zware compound tot hoge herhalingen als afsluiter.",
    goals: ["muscle"],
    badges: ["muscle", "intense"],
    minutes: 45,
    level: "intermediate",
    photoSlug: "push-up-progression",
    groups: {
      a: { type: "superset", rounds: 4, restSeconds: 120 },
      b: { type: "superset", rounds: 3, restSeconds: 90 },
      c: { type: "superset", rounds: 3, restSeconds: 75 },
    },
    items: [
      {
        slug: "close-grip-bench-press",
        sets: 4,
        reps: "8-10",
        restSeconds: 45,
        notes: "Ga direct door naar de barbell curl.",
        group: "a",
      },
      { slug: "barbell-curl", sets: 4, reps: "8-10", restSeconds: 120, group: "a" },
      {
        slug: "overhead-tricep-extension",
        sets: 3,
        reps: "10-12",
        restSeconds: 45,
        notes: "Ga direct door naar de incline dumbbell curl.",
        group: "b",
      },
      {
        slug: "incline-db-curl",
        sets: 3,
        reps: "10-12",
        restSeconds: 90,
        notes: "Laat je armen achter je lichaam hangen voor de volle rek.",
        group: "b",
      },
      {
        slug: "tricep-pushdown",
        sets: 3,
        reps: "12-15",
        restSeconds: 45,
        notes: "Ga direct door naar de hammer curl.",
        group: "c",
      },
      { slug: "hammer-curl", sets: 3, reps: "12-15", restSeconds: 75, group: "c" },
    ],
  },
  // Rugdag volgens de programmeerrichtlijnen van Renaissance Periodization:
  // volume gelijk verdeeld over verticaal en horizontaal trekken, hier zeven om
  // zeven sets. Bewust zonder deadlift en biceps-isolatie, zodat alle
  // herstelcapaciteit naar de lats en de bovenrug gaat.
  {
    key: "rugdag",
    name: "Rugdag",
    description:
      "Een complete rugdag met even veel verticaal als horizontaal trekken, van zwaar tot hoge herhalingen.",
    goals: ["muscle", "strength"],
    badges: ["muscle", "strength"],
    minutes: 55,
    level: "intermediate",
    photoSlug: "pull-up-progression",
    items: [
      {
        slug: "pull-up",
        sets: 4,
        reps: "AMRAP",
        restSeconds: 120,
        notes: "Lukt het niet op eigen kracht? Gebruik een band of de assisted pull-up machine.",
      },
      {
        slug: "chest-supported-db-row",
        sets: 4,
        reps: "8-10",
        restSeconds: 120,
        notes: "Borst blijft op de bank, zo spaar je je onderrug.",
      },
      { slug: "lat-pulldown", sets: 3, reps: "10-12", restSeconds: 90 },
      { slug: "seated-cable-row", sets: 3, reps: "10-12", restSeconds: 90 },
      {
        slug: "straight-arm-pulldown",
        sets: 3,
        reps: "12-15",
        restSeconds: 60,
        notes: "Armen bijna gestrekt, de beweging komt uit je lats.",
      },
      { slug: "face-pull", sets: 3, reps: "15-20", restSeconds: 60 },
    ],
  },

  // -------------------------------------------------------------------------
  // Volledige lichaamstraining
  // -------------------------------------------------------------------------
  {
    key: "fullbody-45",
    name: "Full body 45 min",
    description: "Het hele lichaam in drie kwartier, ideaal als je 2 of 3 keer per week traint.",
    goals: ["muscle", "health", "strength"],
    badges: ["beginner"],
    minutes: 45,
    level: "beginner",
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
  // Gebouwd op de vijf basisbewegingen van Dan John (duwen, trekken, kantelen,
  // squatten, dragen) uit Intervention en Now What?. Geen bank of rek nodig,
  // geen bewegingspatroon overgeslagen.
  {
    key: "vijf-basisbewegingen",
    name: "Vijf basisbewegingen",
    description:
      "Squatten, kantelen vanuit je heupen, duwen, trekken en dragen: het hele lichaam met een paar dumbbells.",
    goals: ["strength", "muscle", "health"],
    badges: ["strength", "muscle"],
    minutes: 40,
    level: "intermediate",
    photoSlug: "dumbbell-only-full-body",
    items: [
      {
        slug: "dumbbell-front-squat",
        sets: 3,
        reps: "8",
        restSeconds: 90,
        notes: "Dumbbells op je schouders, borst omhoog.",
      },
      {
        slug: "dumbbell-romanian-deadlift",
        sets: 3,
        reps: "8-10",
        restSeconds: 90,
        notes: "Kantel vanuit je heupen, rug recht.",
      },
      {
        slug: "dumbbell-floor-press",
        sets: 3,
        reps: "8-10",
        restSeconds: 90,
        notes: "Op de grond, je hebt geen bankje nodig.",
      },
      { slug: "bent-over-db-row", sets: 3, reps: "10", restSeconds: 90 },
      { slug: "dumbbell-shoulder-press", sets: 3, reps: "8-10", restSeconds: 75 },
      {
        slug: "dumbbell-farmers-walk",
        sets: 2,
        reps: "30s",
        restSeconds: 60,
        notes: "Loop rond met de dumbbells langs je zij, romp strak.",
      },
    ],
  },
  // Full body met alleen een weerstandsband, het standaardrepertoire uit
  // fysio- en reisprogramma's. Een band geeft oplopende weerstand, dus je
  // stuurt de zwaarte met je standafstand.
  {
    key: "band-fullbody-30",
    name: "Full body met band",
    description: "Full body met weerstandsbanden en je eigen lichaamsgewicht, overal te doen op een matje.",
    goals: ["muscle", "health", "stability"],
    badges: ["beginner", "muscle"],
    minutes: 30,
    level: "beginner",
    photoSlug: "dumbbell-travel-30min",
    items: [
      {
        slug: "banded-squat",
        sets: 3,
        reps: "12-15",
        restSeconds: 60,
        notes: "Band boven je knieën, duw ze naar buiten.",
      },
      {
        slug: "banded-romanian-deadlift",
        sets: 3,
        reps: "12-15",
        restSeconds: 60,
        notes: "Kantel vanuit je heupen, houd de band strak.",
      },
      {
        slug: "bodyweight-reverse-lunge",
        sets: 3,
        reps: "10/zijde",
        restSeconds: 60,
        notes: "Stap achteruit en zak recht naar beneden.",
      },
      {
        slug: "push-up",
        sets: 3,
        reps: "8-15",
        restSeconds: 60,
        notes: "Te zwaar? Zet je handen hoger, op een tafel of aanrecht.",
      },
      {
        slug: "pike-push-ups",
        sets: 3,
        reps: "8-12",
        restSeconds: 60,
        notes: "Heupen hoog, hoofd richting de grond.",
      },
      {
        slug: "band-pull-apart",
        sets: 3,
        reps: "15-20",
        restSeconds: 45,
        notes: "Armen gestrekt, knijp je schouderbladen samen.",
      },
      {
        slug: "banded-lateral-walk",
        sets: 2,
        reps: "10/zijde",
        restSeconds: 45,
        notes: "Blijf laag zitten, stap opzij zonder te wiebelen.",
      },
      { slug: "plank", sets: 2, reps: "45s", restSeconds: 45 },
    ],
  },
  // Opgezet volgens de ACSM-richtlijn voor krachttraining: 1 tot 3 series over
  // de belangrijkste bewegingspatronen, machines en vrije gewichten als
  // gelijkwaardig behandeld. Machines hebben een vast bewegingspad en vragen
  // geen spotter, wat de drempel voor een beginner laag houdt. Bewust rechte
  // series en geen circuit: bij 12 tot 15 herhalingen hoort echte rust.
  {
    key: "start-met-machines",
    name: "Start met machines",
    description:
      "Een complete training op machines en kabels, ideaal als je je nog niet zeker voelt bij de vrije gewichten.",
    goals: ["health", "strength", "muscle"],
    badges: ["beginner"],
    minutes: 40,
    level: "beginner",
    photoSlug: "upper-lower-4-day",
    items: [
      {
        slug: "leg-press",
        sets: 3,
        reps: "12-15",
        restSeconds: 90,
        notes: "Duw door je hielen en stop 2 tot 3 herhalingen voordat je niet meer kunt.",
      },
      { slug: "seated-leg-curl", sets: 2, reps: "12-15", restSeconds: 60 },
      {
        slug: "chest-press-machine",
        sets: 3,
        reps: "12-15",
        restSeconds: 60,
        notes: "Stel de stoel zo in dat de handvatten op borsthoogte staan.",
      },
      {
        slug: "lat-pulldown",
        sets: 3,
        reps: "12-15",
        restSeconds: 60,
        notes: "Trek de stang naar je borst, niet achter je nek.",
      },
      { slug: "machine-shoulder-press", sets: 2, reps: "12-15", restSeconds: 60 },
      {
        slug: "seated-cable-row",
        sets: 2,
        reps: "12-15",
        restSeconds: 60,
        notes: "Houd je rug recht en trek je schouderbladen naar elkaar toe.",
      },
      { slug: "machine-seated-crunch", sets: 2, reps: "15", restSeconds: 45 },
    ],
  },

  // -------------------------------------------------------------------------
  // Krachtprogramma's met de barbell
  // -------------------------------------------------------------------------
  // Mark Rippetoe, Starting Strength (2005). Lineaire progressie voor
  // beginners: drie werksets van vijf, elke training 2,5 kg erbij, en maar één
  // zware deadliftset. Je wisselt A en B af.
  {
    key: "starting-strength-a",
    name: "Starting Strength A",
    description: "De A-training van Starting Strength: squat, bench press en een zware deadlift.",
    goals: ["strength", "muscle", "health"],
    badges: ["beginner", "strength"],
    minutes: 50,
    level: "beginner",
    photoSlug: "full-body-3-day-beginner",
    items: [
      {
        slug: "squat",
        sets: 3,
        reps: "5",
        restSeconds: 240,
        notes: "Alle drie de series op hetzelfde gewicht. Haal je ze allemaal, ga dan 2,5 kg omhoog.",
      },
      {
        slug: "bench-press",
        sets: 3,
        reps: "5",
        restSeconds: 180,
        notes: "Zelfde gewicht over de drie series, per training 1 tot 2,5 kg erbij.",
      },
      {
        slug: "deadlift",
        sets: 1,
        reps: "5",
        restSeconds: 180,
        notes: "Eén zware werkset na je opwarmreeksen, dat is bij Rippetoe genoeg.",
      },
      {
        slug: "chin-ups",
        sets: 3,
        reps: "AMRAP",
        restSeconds: 90,
        notes: "Optioneel extra werk. Lukt er nog geen? Gebruik een band of doe negatives.",
      },
    ],
  },
  // De tegenhanger van A. In het origineel staat hier de power clean; zonder
  // coaching is de deadlift de gangbare vervanger, met de barbell row als
  // trekwerk erbij.
  {
    key: "starting-strength-b",
    name: "Starting Strength B",
    description: "De B-training van Starting Strength: squat, overhead press en trekwerk.",
    goals: ["strength", "muscle", "health"],
    badges: ["beginner", "strength"],
    minutes: 50,
    level: "beginner",
    photoSlug: "stronglifts-5x5",
    items: [
      {
        slug: "squat",
        sets: 3,
        reps: "5",
        restSeconds: 240,
        notes: "Alle drie de series op hetzelfde gewicht, elke training 2,5 kg erbij.",
      },
      {
        slug: "ohp",
        sets: 3,
        reps: "5",
        restSeconds: 180,
        notes: "Ga per training 1 tot 2,5 kg omhoog, dit is je traagst groeiende lift.",
      },
      {
        slug: "deadlift",
        sets: 1,
        reps: "5",
        restSeconds: 180,
        notes: "Eén zware werkset. In het originele programma staat hier de power clean.",
      },
      {
        slug: "barbell-row",
        sets: 3,
        reps: "8",
        restSeconds: 120,
        notes: "Trekwerk als tegenwicht voor al het drukken.",
      },
    ],
  },
  // GZCLP van Cody LeFever: drie niveaus per sessie. T1 zwaar en laag in
  // herhalingen, T2 volume, T3 licht met de laatste set tot bijna falen.
  // Veelgebruikt vervolg zodra Starting Strength vastloopt.
  {
    key: "gzclp-deadlift-dag",
    name: "GZCLP deadlift-dag",
    description:
      "Een dag uit GZCLP in drie niveaus: zwaar deadliften, daarna volume op de overhead press en licht trekwerk.",
    goals: ["strength", "muscle"],
    badges: ["strength", "hypertrophy"],
    minutes: 60,
    level: "intermediate",
    photoSlug: "powerlifting-peaking-4-day",
    items: [
      {
        slug: "deadlift",
        sets: 5,
        reps: "3",
        restSeconds: 180,
        notes: "T1: vijf series van 3 op ongeveer 85% van je 5RM. Op de laatste set ga je zover je kunt.",
      },
      {
        slug: "ohp",
        sets: 3,
        reps: "10",
        restSeconds: 120,
        notes: "T2: duidelijk lichter dan je T1, drie series van 10 op hetzelfde gewicht.",
      },
      {
        slug: "lat-pulldown",
        sets: 3,
        reps: "15",
        restSeconds: 60,
        notes: "T3: laatste set zoveel mogelijk herhalingen. Haal je er 25 of meer, ga dan omhoog.",
      },
      {
        slug: "bent-over-db-row",
        sets: 3,
        reps: "15",
        restSeconds: 60,
        notes: "T3: laatste set zoveel mogelijk herhalingen.",
      },
      { slug: "hammer-curl", sets: 3, reps: "15", restSeconds: 45 },
    ],
  },

  // -------------------------------------------------------------------------
  // Specialisatie
  // -------------------------------------------------------------------------
  // Bret Contreras (Glute Lab, Strong Curves), die de barbell hip thrust
  // onderbouwde met EMG-onderzoek. Zijn indeling combineert zwaar werk met
  // hoge herhalingen in dezelfde sessie.
  {
    key: "bilspierdag",
    name: "Bilspierdag",
    description:
      "Alles voor je bilspieren rond de hip thrust, met zware sets en hoge herhalingen in dezelfde training.",
    goals: ["muscle", "strength"],
    badges: ["muscle", "hypertrophy"],
    minutes: 50,
    level: "intermediate",
    photoSlug: "glutes-focus",
    items: [
      {
        slug: "hip-thrust",
        sets: 4,
        reps: "8-10",
        restSeconds: 150,
        notes: "Pauzeer 1 seconde bovenin en houd je kin naar je borst.",
      },
      {
        slug: "bulgarian-split-squat",
        sets: 3,
        reps: "10/zijde",
        restSeconds: 90,
        notes: "Leun licht voorover, dan doen je bilspieren meer werk.",
      },
      {
        slug: "cable-pull-through",
        sets: 3,
        reps: "12-15",
        restSeconds: 60,
        notes: "Duw je heupen naar achteren, de beweging komt uit je heupen en niet uit je armen.",
      },
      {
        slug: "back-extension",
        sets: 3,
        reps: "15",
        restSeconds: 60,
        notes: "Stop bij een rechte lijn, ga niet in overstrekking.",
      },
      {
        slug: "hip-abduction",
        sets: 3,
        reps: "20-30",
        restSeconds: 45,
        notes: "Houd de laatste herhaling 5 seconden vast.",
      },
      { slug: "cable-kickback", sets: 3, reps: "12/zijde", restSeconds: 45 },
    ],
  },
  // Blessurepreventie voor de hamstring. De meta-analyse van van Dyk (8.459
  // sporters) laat ongeveer een halvering van hamstringblessures zien bij
  // Nordic-curl-programma's. De Nordic staat bewust vooraan: maximaal
  // excentrisch werk hoort op verse benen, niet na drie zware RDL-series.
  {
    key: "achterste-keten",
    name: "Achterste keten",
    description:
      "Hamstrings, bilspieren en onderrug sterker en belastbaarder maken, met de Nordic curl vooraan.",
    goals: ["strength", "sport"],
    badges: ["strength", "rehab"],
    minutes: 45,
    level: "intermediate",
    photoSlug: "powerlifting-peaking-4-day",
    items: [
      {
        slug: "nordic-hamstring-curl",
        sets: 2,
        reps: "5",
        restSeconds: 120,
        notes:
          "Geen apparaat? Laat een trainer of partner je enkels vasthouden. Bouw op vanaf 2 series van 3.",
      },
      {
        slug: "romanian-deadlift",
        sets: 3,
        reps: "6-8",
        restSeconds: 150,
        notes: "Houd je rug recht en zak tot je rek voelt in je hamstrings.",
      },
      {
        slug: "seated-leg-curl",
        sets: 3,
        reps: "10-12",
        restSeconds: 60,
        notes: "Zittend rek je de hamstring verder uit dan liggend, dat levert meer groei op.",
      },
      { slug: "back-extension", sets: 2, reps: "12-15", restSeconds: 60 },
      {
        slug: "standing-calf-raise",
        sets: 3,
        reps: "12-15",
        restSeconds: 45,
        notes: "Volledige rek onderin, korte pauze bovenin.",
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Bodyweight en calisthenics
  // -------------------------------------------------------------------------
  // De Recommended Routine van r/bodyweightfitness, een door de community
  // onderhouden wiki-programma. Werkt in koppels: terwijl je duwt rust je
  // trekwerk en andersom.
  {
    key: "calisthenics-fullbody",
    name: "Calisthenics full body",
    description:
      "De kern van de bekende Recommended Routine: duwen, trekken en benen in koppels, met je eigen lichaamsgewicht.",
    goals: ["strength", "muscle", "health"],
    badges: ["strength"],
    minutes: 60,
    level: "intermediate",
    photoSlug: "home-bodyweight-beginner",
    groups: {
      a: { type: "superset", rounds: 3, restSeconds: 90 },
      b: { type: "superset", rounds: 3, restSeconds: 90 },
      c: { type: "superset", rounds: 3, restSeconds: 90 },
      d: { type: "superset", rounds: 3, restSeconds: 60 },
    },
    items: [
      {
        slug: "pull-up",
        sets: 3,
        reps: "5-8",
        restSeconds: 90,
        notes: "Lukken er nog geen? Kies assisted pull-ups of negatives.",
        group: "a",
      },
      {
        slug: "split-squat",
        sets: 3,
        reps: "8/zijde",
        restSeconds: 90,
        notes: "Te makkelijk? Zet je achterste voet op een bank.",
        group: "a",
      },
      {
        slug: "dips",
        sets: 3,
        reps: "5-8",
        restSeconds: 90,
        notes: "Te zwaar? Begin met bench dips.",
        group: "b",
      },
      {
        slug: "single-leg-glute-bridge",
        sets: 3,
        reps: "10/zijde",
        restSeconds: 90,
        notes: "Voet op een bank maakt het zwaarder.",
        group: "b",
      },
      {
        slug: "inverted-row",
        sets: 3,
        reps: "8-12",
        restSeconds: 90,
        notes: "Hoe platter je onder de stang ligt, hoe zwaarder.",
        group: "c",
      },
      {
        slug: "push-up",
        sets: 3,
        reps: "8-12",
        restSeconds: 90,
        notes: "Te makkelijk? Voeten omhoog of diamond push-ups.",
        group: "c",
      },
      {
        slug: "hollow-body-hold",
        sets: 3,
        reps: "30s",
        restSeconds: 60,
        notes: "Houd je onderrug tegen de grond.",
        group: "d",
      },
      {
        slug: "side-plank",
        sets: 3,
        reps: "30s",
        restSeconds: 60,
        notes: "Per kant, heup hoog houden.",
        group: "d",
      },
    ],
  },
  // Duwprogressie richting de handstand push-up, zoals de calisthenics-
  // progressies van r/bodyweightfitness die opbouwen: eerst de pike push-up met
  // de voeten steeds hoger, pas daarna de muur.
  {
    key: "dips-handstand",
    name: "Dips en handstand",
    description:
      "Werk toe naar de handstand push-up met pike push-ups, dips en L-sit, aangevuld met triceps- en rompwerk.",
    goals: ["strength", "muscle"],
    badges: ["strength"],
    minutes: 40,
    level: "intermediate",
    photoSlug: "push-up-progression",
    items: [
      {
        slug: "l-sit",
        sets: 3,
        reps: "20s",
        restSeconds: 90,
        notes: "Begin met gebogen knieën en strek pas als 20 seconden lukt.",
      },
      {
        slug: "pike-push-ups",
        sets: 4,
        reps: "6-10",
        restSeconds: 120,
        notes: "Voeten op een bank maakt het zwaarder, richting handstand push-up.",
      },
      {
        slug: "dips",
        sets: 3,
        reps: "5-8",
        restSeconds: 120,
        notes: "Nog te zwaar? Kies assisted dips of bench dips.",
      },
      {
        slug: "diamond-push-ups",
        sets: 3,
        reps: "8-12",
        restSeconds: 90,
        notes: "Handen dicht bij elkaar, ellebogen langs je lijf.",
      },
      {
        slug: "hollow-body-hold",
        sets: 3,
        reps: "30s",
        restSeconds: 60,
        notes: "De rompspanning die je in elke handstand nodig hebt.",
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Benchmarks en circuits
  // -------------------------------------------------------------------------
  {
    key: "hiit-30",
    name: "HIIT 30 min",
    description: "Korte, intensieve intervallen: maximale conditie-prikkel in een half uur.",
    goals: ["conditioning", "fat_loss"],
    badges: ["intense", "conditioning"],
    minutes: 30,
    level: "intermediate",
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
  // Een van de klassieke CrossFit benchmark-workouts (CrossFit HQ, sinds 2005).
  // Gerespecteerd omdat het met minimale apparatuur een eerlijke maatstaf geeft
  // die je maanden later opnieuw kunt lopen.
  {
    key: "cindy-amrap-20",
    name: "Cindy, 20 min AMRAP",
    description:
      "Beroemde CrossFit-benchmark: 20 minuten zoveel mogelijk rondes van 5 pull-ups, 10 push-ups en 15 squats.",
    goals: ["conditioning", "fat_loss", "health"],
    badges: ["conditioning", "intense"],
    minutes: 25,
    level: "intermediate",
    photoSlug: "home-bodyweight-beginner",
    groups: {
      wod: { type: "amrap", restSeconds: 0, label: "Cindy", timeCapSeconds: 1200 },
    },
    items: [
      {
        slug: "jump-rope",
        sets: 2,
        reps: "60s",
        restSeconds: 30,
        notes: "Warming-up, telt niet mee in de AMRAP.",
      },
      {
        slug: "pull-up",
        sets: 8,
        reps: "5",
        restSeconds: 0,
        notes: "Lukken pull-ups nog niet? Kies band assisted pull-ups of inverted rows.",
        group: "wod",
      },
      {
        slug: "push-up",
        sets: 8,
        reps: "10",
        restSeconds: 0,
        notes: "Geen rust binnen de ronde, ga direct door naar de squats.",
        group: "wod",
      },
      {
        slug: "bodyweight-squat",
        sets: 8,
        reps: "15",
        restSeconds: 0,
        notes: "Elke set is een ronde. Acht rondes is een prima score, meer mag altijd.",
        group: "wod",
      },
    ],
  },
  // CrossFit benchmark-workout Helen: drie rondes van 400 meter hardlopen, 21
  // kettlebell swings en 12 pull-ups, op tijd. Een van de best gedocumenteerde
  // maatstaven voor gemengde conditie.
  {
    key: "helen-3-rondes",
    name: "Helen, 3 rondes",
    description:
      "CrossFit-benchmark op tijd: 3 rondes van 400 meter hardlopen, 21 kettlebell swings en 12 pull-ups.",
    goals: ["conditioning", "fat_loss", "sport"],
    badges: ["conditioning", "intense"],
    minutes: 25,
    level: "intermediate",
    photoSlug: "kettlebell-complex",
    groups: {
      wod: { type: "circuit", rounds: 3, restSeconds: 0, label: "Helen" },
    },
    items: [
      {
        slug: "kettlebell-deadlift",
        sets: 2,
        reps: "8",
        restSeconds: 45,
        notes: "Warming-up voor je heupscharnier, telt niet mee in de tijd.",
      },
      {
        slug: "running",
        sets: 3,
        reps: "400m",
        restSeconds: 0,
        notes: "De klok loopt door, dit is de start van elke ronde.",
        group: "wod",
      },
      {
        slug: "kettlebell-swing",
        sets: 3,
        reps: "21",
        restSeconds: 0,
        notes: "Standaard is 24 kg voor mannen en 16 kg voor vrouwen, zwaai tot ooghoogte of hoger.",
        group: "wod",
      },
      {
        slug: "pull-up",
        sets: 3,
        reps: "12",
        restSeconds: 0,
        notes: "Sluit de ronde af en ga direct weer lopen. Schaal met band assisted pull-ups.",
        group: "wod",
      },
    ],
  },
  // Klassiek bodyweight-stationcircuit: 30 seconden werk, 10 seconden wissel,
  // drie rondes langs negen stations. Vraagt niets meer dan een stukje vloer.
  {
    key: "circuit-zonder-materiaal",
    name: "Circuit zonder materiaal",
    description: "Negen oefeningen op rij, 30 seconden werk en 10 seconden wissel, zonder materiaal.",
    goals: ["conditioning", "fat_loss", "health"],
    badges: ["conditioning", "intense"],
    minutes: 20,
    level: "beginner",
    photoSlug: "home-bodyweight-beginner",
    groups: {
      ronde: { type: "circuit", rounds: 3, restSeconds: 60 },
    },
    items: [
      { slug: "jumping-jacks", sets: 3, reps: "30s", restSeconds: 10, group: "ronde" },
      {
        slug: "wall-sit",
        sets: 3,
        reps: "30s",
        restSeconds: 10,
        notes: "Rug plat tegen de muur, knieën in een rechte hoek.",
        group: "ronde",
      },
      { slug: "push-up", sets: 3, reps: "30s", restSeconds: 10, group: "ronde" },
      { slug: "bodyweight-squat", sets: 3, reps: "30s", restSeconds: 10, group: "ronde" },
      {
        slug: "reverse-plank-dips",
        sets: 3,
        reps: "30s",
        restSeconds: 10,
        notes: "Handen achter je op de vloer, heupen omhoog en zak door je ellebogen.",
        group: "ronde",
      },
      { slug: "plank", sets: 3, reps: "30s", restSeconds: 10, group: "ronde" },
      { slug: "high-knees", sets: 3, reps: "30s", restSeconds: 10, group: "ronde" },
      {
        slug: "bodyweight-reverse-lunge",
        sets: 3,
        reps: "30s",
        restSeconds: 10,
        notes: "Wissel elke herhaling van been.",
        group: "ronde",
      },
      {
        slug: "side-plank",
        sets: 3,
        reps: "30s",
        restSeconds: 10,
        notes: "Halve tijd links, halve tijd rechts.",
        group: "ronde",
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Conditie en cardio
  // -------------------------------------------------------------------------
  // Ontwikkeld door Helgerud en Hoff aan de NTNU in Trondheim en doorontwikkeld
  // door de Cardiac Exercise Research Group. Het best onderzochte intervalrecept
  // voor een hogere VO2max.
  {
    key: "noorse-4x4",
    name: "Noorse 4x4",
    description:
      "Vier blokken van 4 minuten op 90 tot 95% van je maximale hartslag, het best onderzochte recept voor een hogere VO2max.",
    goals: ["conditioning", "health"],
    badges: ["intense", "conditioning"],
    minutes: 45,
    level: "advanced",
    photoSlug: "hiit-cardio-20min",
    items: [
      {
        slug: "leg-swing-front-to-back",
        sets: 2,
        reps: "10/zijde",
        restSeconds: 20,
        notes: "Heupen losmaken voor je op de band stapt.",
      },
      {
        slug: "incline-treadmill-walk",
        sets: 1,
        reps: "600s",
        restSeconds: 60,
        notes: "Tien minuten warming-up, bouw rustig op naar ongeveer 70% van je maximale hartslag.",
      },
      {
        slug: "treadmill-running",
        sets: 4,
        reps: "240s",
        restSeconds: 180,
        notes:
          "De kern: vier minuten op 90 tot 95% van je maximale hartslag, daarna drie minuten rustig doorlopen.",
      },
      {
        slug: "walking",
        sets: 1,
        reps: "300s",
        restSeconds: 0,
        notes: "Vijf minuten uitlopen tot je hartslag weer rustig is.",
      },
      {
        slug: "downward-dog",
        sets: 2,
        reps: "30s",
        restSeconds: 15,
        notes: "Kuiten en hamstrings lang maken.",
      },
    ],
  },
  // Zone 2-basistraining zoals Inigo San Millan en Peter Attia die beschrijven:
  // langdurig op een tempo waarop je nog hele zinnen kunt praten. Bewust één
  // doorlopend blok en geen rondje langs vier machines, want juist het
  // ononderbroken deel op een stabiele hartslag is waar het om draait.
  {
    key: "zone-2-basis",
    name: "Zone 2 basis",
    description: "Een uur rustige duurtraining op praattempo, de basis onder je uithoudingsvermogen.",
    goals: ["conditioning", "health", "fat_loss"],
    badges: ["beginner", "conditioning"],
    minutes: 60,
    level: "beginner",
    photoSlug: "hiit-cardio-20min",
    items: [
      {
        slug: "incline-treadmill-walk",
        sets: 1,
        reps: "600s",
        restSeconds: 0,
        notes: "Tien minuten rustig inwandelen tot je ademhaling op gang komt.",
      },
      {
        slug: "stationary-bike",
        sets: 1,
        reps: "2400s",
        restSeconds: 0,
        notes:
          "Veertig minuten in zone 2: je kunt nog hele zinnen praten, maar het voelt niet als niets doen.",
      },
      {
        slug: "walking",
        sets: 1,
        reps: "480s",
        restSeconds: 0,
        notes: "Acht minuten uitwandelen tot je hartslag zakt.",
      },
      {
        slug: "childs-pose",
        sets: 1,
        reps: "60s",
        restSeconds: 0,
        notes: "Rustig afsluiten en je ademhaling omlaag brengen.",
      },
    ],
  },
  // Het originele protocol uit het onderzoek van Izumi Tabata (1996): acht keer
  // 20 seconden alles geven met 10 seconden rust, na een grondige warming-up.
  // Vier minuten die echt tellen.
  {
    key: "tabata-20-10",
    name: "Tabata 20/10",
    description:
      "Het originele protocol van Izumi Tabata: na een goede warming-up acht keer 20 seconden alles geven met 10 seconden rust.",
    goals: ["conditioning", "fat_loss"],
    badges: ["intense", "conditioning"],
    minutes: 20,
    level: "advanced",
    photoSlug: "kettlebell-complex",
    items: [
      {
        slug: "stationary-bike",
        sets: 1,
        reps: "600s",
        restSeconds: 60,
        notes: "Tien minuten warming-up, precies zoals in het onderzoek.",
      },
      {
        slug: "jumping-jacks",
        sets: 2,
        reps: "30s",
        restSeconds: 30,
        notes: "Kort scherp maken zodat je de eerste ronde echt vol kunt gaan.",
      },
      {
        slug: "air-bike",
        sets: 8,
        reps: "20s",
        restSeconds: 10,
        notes: "Het protocol: 20 seconden alles geven, 10 seconden stil, acht rondes achter elkaar.",
      },
      {
        slug: "walking",
        sets: 1,
        reps: "300s",
        restSeconds: 0,
        notes: "Vijf minuten uitwandelen tot je hartslag zakt.",
      },
    ],
  },
  // Klassieke roei-intervaltraining: acht keer 500 meter op je 2K-tempo met
  // ruime rust. Standaardkost in roeiprogramma's en op Concept2-trainingsplannen.
  {
    key: "roei-500m",
    name: "Roeien 8x500m",
    description:
      "Acht keer 500 meter op je 2K-tempo met ruime rust, de klassieke intervaltraining op de roeimachine.",
    goals: ["conditioning", "fat_loss"],
    badges: ["intense", "conditioning"],
    minutes: 50,
    level: "intermediate",
    photoSlug: "hiit-cardio-20min",
    items: [
      { slug: "jumping-jacks", sets: 2, reps: "45s", restSeconds: 30, notes: "Algemene warming-up." },
      {
        slug: "band-pull-apart",
        sets: 2,
        reps: "15",
        restSeconds: 30,
        notes: "Schouderbladen wakker maken voor het trekken.",
      },
      {
        slug: "bodyweight-squat",
        sets: 2,
        reps: "10",
        restSeconds: 30,
        notes: "Heupen en knieën losmaken voor de beenzet.",
      },
      {
        slug: "rowing-machine",
        sets: 8,
        reps: "500m",
        restSeconds: 210,
        notes: "Ga per 500 meter op je 2K-tempo, met 3,5 minuut rust. De laatste moet net zo snel zijn als de eerste.",
      },
      {
        slug: "walking",
        sets: 1,
        reps: "300s",
        restSeconds: 0,
        notes: "Vijf minuten uitwandelen.",
      },
      {
        slug: "childs-pose",
        sets: 1,
        reps: "45s",
        restSeconds: 0,
        notes: "Onderrug en lats rustig lang maken.",
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Kettlebell
  // -------------------------------------------------------------------------
  // Pavel Tsatsouline, Kettlebell Simple & Sinister (2013, StrongFirst). Twee
  // bewegingen, vaste tijdvakken, heldere standaarden. Waarschijnlijk het meest
  // gevolgde kettlebell-programma ooit geschreven.
  {
    key: "simple-sinister",
    name: "Simple en Sinister",
    description:
      "Het klassieke kettlebell-programma van Pavel Tsatsouline: swings en Turkish get-ups met één bel.",
    goals: ["strength", "conditioning", "mobility"],
    badges: ["strength", "conditioning"],
    minutes: 30,
    level: "intermediate",
    photoSlug: "kettlebell-complex",
    items: [
      {
        slug: "kettlebell-halo",
        sets: 2,
        reps: "5/zijde",
        restSeconds: 30,
        notes: "Rustige cirkels om je hoofd, beide kanten op.",
      },
      {
        slug: "goblet-squat",
        sets: 2,
        reps: "5",
        restSeconds: 30,
        notes: "Zak diep, blijf onderin even hangen en duw je knieën naar buiten.",
      },
      {
        slug: "glute-bridge",
        sets: 2,
        reps: "10",
        restSeconds: 30,
        notes: "Knijp je billen twee tellen aan boven.",
      },
      {
        slug: "kettlebell-swing",
        sets: 10,
        reps: "10",
        restSeconds: 30,
        notes: "Tien swings, dan rust tot de halve minuut om is.",
      },
      {
        slug: "kettlebell-turkish-get-ups",
        sets: 10,
        reps: "1",
        restSeconds: 45,
        notes: "Eén per minuut, wissel steeds van arm.",
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Romp
  // -------------------------------------------------------------------------
  {
    key: "core-15",
    name: "Core 15 min",
    description: "Een kort maar compleet rompcircuit, ook goed als afsluiter na je training.",
    goals: ["stability", "muscle"],
    badges: [],
    minutes: 15,
    level: "beginner",
    photoSlug: "core-finisher-10min",
    items: [
      { slug: "plank", sets: 3, reps: "45s", restSeconds: 30 },
      { slug: "bicycle-crunch", sets: 3, reps: "20", restSeconds: 30 },
      { slug: "russian-twist", sets: 3, reps: "20", restSeconds: 30 },
      { slug: "hanging-leg-raise", sets: 3, reps: "10-15", restSeconds: 30 },
      { slug: "bird-dog-hold", sets: 3, reps: "8/zijde", restSeconds: 30 },
    ],
  },
  // Prof. Stuart McGill, wervelkolombiomechanicus aan de University of Waterloo.
  // Uit zijn lab- en klinisch werk komen drie oefeningen (curl-up, side plank,
  // bird dog) die rompstijfheid opbouwen zonder de wervelkolom zwaar te buigen.
  {
    key: "mcgill-big-3",
    name: "McGill Big 3",
    description: "Het rompprotocol van Stuart McGill: stabiliteit opbouwen zonder je onderrug zwaar te belasten.",
    goals: ["rehab", "stability", "health"],
    badges: ["rehab", "beginner"],
    minutes: 20,
    level: "beginner",
    photoSlug: "core-finisher-10min",
    items: [
      {
        slug: "cat-cow",
        sets: 1,
        reps: "8",
        restSeconds: 30,
        notes: "Warming-up voor je rug: rustig heen en weer rollen, nooit doorduwen tot pijn.",
      },
      {
        slug: "dead-bug",
        sets: 3,
        reps: "6/zijde",
        restSeconds: 30,
        notes: "Onderrug plat op de vloer, beweeg alleen je arm en been.",
      },
      {
        slug: "side-plank",
        sets: 3,
        reps: "20s",
        restSeconds: 30,
        notes:
          "Per kant. Houd de holds kort en reset tussendoor, liever dat dan doorgaan tot je vorm wegzakt.",
      },
      {
        slug: "bird-dog",
        sets: 3,
        reps: "6/zijde",
        restSeconds: 30,
        notes: "Houd elke herhaling 8 tot 10 seconden vast en houd je heupen recht.",
      },
      {
        slug: "glute-bridge",
        sets: 3,
        reps: "12",
        restSeconds: 45,
        notes: "Knijp je billen aan en duw je heupen omhoog zonder je rug hol te trekken.",
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Mobiliteit en prehab
  // -------------------------------------------------------------------------
  {
    key: "mobiliteit-20",
    name: "Mobiliteit 20 min",
    description: "Rustige mobiliteits- en stabiliteitsoefeningen, ook geschikt als hersteldag.",
    goals: ["mobility", "rehab", "health"],
    badges: ["mobility"],
    minutes: 20,
    level: "beginner",
    photoSlug: "mobility-warm-up-10min",
    items: [
      { slug: "dead-hang", sets: 2, reps: "30s", restSeconds: 30 },
      { slug: "scapular-pull-ups", sets: 2, reps: "8", restSeconds: 30 },
      { slug: "band-pull-apart", sets: 2, reps: "15", restSeconds: 30 },
      { slug: "dumbbell-windmill", sets: 2, reps: "5/zijde", restSeconds: 30 },
      { slug: "bird-dog-hold", sets: 2, reps: "8/zijde", restSeconds: 30 },
      { slug: "plank", sets: 2, reps: "30s", restSeconds: 30 },
    ],
  },
  // Opgebouwd volgens de RAMP-methode (Raise, Activate, Mobilise, Potentiate)
  // van Ian Jeffreys, het standaardmodel voor een warming-up in de
  // sportwetenschap. Vervangt het statische rekken vooraf dat kracht juist remt.
  {
    key: "dynamische-warming-up",
    name: "Dynamische warming-up",
    description: "Vier fasen: warm worden, activeren, mobiliseren en explosief afsluiten.",
    goals: ["mobility", "sport", "conditioning"],
    badges: ["mobility", "beginner"],
    minutes: 12,
    level: "beginner",
    photoSlug: "home-bodyweight-beginner",
    items: [
      {
        slug: "jumping-jacks",
        sets: 2,
        reps: "45s",
        restSeconds: 15,
        notes: "Warm worden op rustig tempo, je moet nog kunnen praten.",
      },
      {
        slug: "glute-bridge",
        sets: 2,
        reps: "12",
        restSeconds: 20,
        notes: "Activeren: knijp bovenin een tel aan en duw vanuit je hielen, niet hoger door je onderrug.",
      },
      {
        slug: "bird-dog",
        sets: 2,
        reps: "8/zijde",
        restSeconds: 20,
        notes: "Activeren: houd je heupen recht, alsof er een glas water op je onderrug staat.",
      },
      {
        slug: "leg-swing-front-to-back",
        sets: 1,
        reps: "12/zijde",
        restSeconds: 15,
        notes: "Mobiliseren: bouw de hoogte per zwaai op, zwaai nooit met een ruk voorbij je controle.",
      },
      {
        slug: "lateral-leg-swing",
        sets: 1,
        reps: "12/zijde",
        restSeconds: 15,
        notes: "Mobiliseren: je romp blijft stil, alleen het been zwaait.",
      },
      {
        slug: "downward-dog-to-low-lunge",
        sets: 2,
        reps: "6/zijde",
        restSeconds: 15,
        notes: "Stap je voet naast je hand en zak zacht in de heup. Blijf bewegen, houd niet lang vast.",
      },
      {
        slug: "bodyweight-squat",
        sets: 2,
        reps: "10",
        restSeconds: 20,
        notes: "Slijp het patroon in dat je zo met gewicht gaat doen, rustig en volledig.",
      },
      {
        slug: "jump-squat",
        sets: 2,
        reps: "5",
        restSeconds: 45,
        notes:
          "Kort en explosief, land zacht met gebogen knieën. Sla deze over bij gevoelige knieën of als je vandaag rustig traint.",
      },
    ],
  },
  // Enkel- en heupmobiliteit gericht op squatdiepte. De enkel is bij de meeste
  // mensen de grootste rem: bij te weinig dorsaalflexie komen de hielen los of
  // kantelt het bekken weg onderin de squat.
  {
    key: "squat-diepte-mobiliteit",
    name: "Squat-diepte mobiliteit",
    description: "Gerichte enkel- en heupmobiliteit zodat je dieper en met plattere hielen kunt squatten.",
    goals: ["mobility", "strength", "stability"],
    badges: ["mobility"],
    minutes: 20,
    level: "intermediate",
    photoSlug: "mobility-warm-up-10min",
    items: [
      {
        slug: "banded-ankle-stretch",
        sets: 2,
        reps: "45s/zijde",
        restSeconds: 20,
        notes: "Band laag om je enkel, knie over je tenen, hiel blijft plat op de grond.",
      },
      {
        slug: "standing-calf-stretch",
        sets: 2,
        reps: "45s/zijde",
        restSeconds: 20,
        notes: "Achterste been gestrekt. Dit pakt de kuitspier die de vorige oefening juist ontziet.",
      },
      {
        slug: "half-kneeling-hip-flexor-rock",
        sets: 2,
        reps: "10/zijde",
        restSeconds: 15,
        notes: "Knijp de bil van je achterste been aan en rock rustig naar voren, blijf lang in je romp.",
      },
      {
        slug: "lizard-stretch",
        sets: 2,
        reps: "45s/zijde",
        restSeconds: 25,
        notes: "Voet naast je hand, zak op je onderarmen als dat lukt. Adem uit in de rek en veer nooit.",
      },
      {
        slug: "cossack-squat",
        sets: 2,
        reps: "8/zijde",
        restSeconds: 30,
        notes: "Zak langzaam opzij met de hiel plat, zonder dat je bekken wegkantelt.",
      },
      {
        slug: "garland-pose",
        sets: 3,
        reps: "45s",
        restSeconds: 30,
        notes:
          "De diepe hurkzit. Ellebogen tegen je binnenknieën, borst omhoog. Komen je hielen los, zet ze op een boekje.",
      },
      {
        slug: "bodyweight-squat",
        sets: 2,
        reps: "10",
        restSeconds: 30,
        notes: "Sluit af in je eigen squat en houd onderin twee tellen vast, zo onthoudt je lichaam de ruimte.",
      },
    ],
  },
  // Conservatieve knieopbouw. De onderdelen die overeind blijven zijn stuk voor
  // stuk standaardkost in de knierevalidatie: terminal knee extension met band,
  // isometrische wall sits (met gedocumenteerd pijnstillend effect bij
  // patellapees-klachten) en langzaam zakkende step-downs.
  {
    key: "sterke-knieen",
    name: "Sterke knieën",
    description: "Rustige opbouw voor sterkere knieën: kuiten, bovenbenen en heupen door hun volledige bereik.",
    goals: ["rehab", "health"],
    badges: ["rehab", "beginner"],
    minutes: 30,
    level: "beginner",
    photoSlug: "home-bodyweight-beginner",
    items: [
      {
        slug: "bodyweight-calf-raise",
        sets: 3,
        reps: "20",
        restSeconds: 45,
        notes: "Volledig omhoog en helemaal omlaag, rustig tempo.",
      },
      {
        slug: "banded-terminal-knee-extension",
        sets: 3,
        reps: "15",
        restSeconds: 45,
        notes: "Strek je knie helemaal en knijp je bovenbeen kort aan.",
      },
      {
        slug: "step-ups",
        sets: 3,
        reps: "8/zijde",
        restSeconds: 60,
        notes: "Zak langzaam terug naar beneden, dat gecontroleerde zakken is het echte werk.",
      },
      {
        slug: "split-squat",
        sets: 3,
        reps: "8/zijde",
        restSeconds: 60,
        notes:
          "Zo diep als pijnvrij lukt, je knie mag voorbij je tenen. Blijft het pijn doen? Vraag een trainer.",
      },
      {
        slug: "wall-sit",
        sets: 2,
        reps: "30s",
        restSeconds: 45,
        notes: "Bouw op naar 45 seconden zodra dit makkelijk aanvoelt.",
      },
      {
        slug: "standing-calf-stretch",
        sets: 2,
        reps: "30s/zijde",
        restSeconds: 20,
        notes: "Hiel op de grond houden, knie licht gebogen.",
      },
      {
        slug: "bench-couch-stretch",
        sets: 2,
        reps: "45s/zijde",
        restSeconds: 30,
        notes: "Knijp je bil aan, dan is de rek veiliger en effectiever.",
      },
    ],
  },
  // Standaard schouderprehab: rotatorcuff en schouderbladbesturing, het werk dat
  // in vrijwel elk fysio- en werpsportprogramma terugkomt als tegenwicht voor
  // veel duwvolume.
  {
    key: "schouderprehab",
    name: "Schouders versterken",
    description: "Rotatorcuff en schouderbladen sterker maken, ideaal naast een programma met veel duwwerk.",
    goals: ["rehab", "stability", "health"],
    badges: ["rehab", "mobility"],
    minutes: 25,
    level: "beginner",
    photoSlug: "ppl-6-day-intermediate",
    items: [
      {
        slug: "band-pull-apart",
        sets: 3,
        reps: "15",
        restSeconds: 45,
        notes: "Armen gestrekt, knijp je schouderbladen rustig naar elkaar toe.",
      },
      {
        slug: "cable-external-rotation",
        sets: 3,
        reps: "12/zijde",
        restSeconds: 45,
        notes: "Elleboog tegen je zij, licht gewicht, rustig tempo.",
      },
      {
        slug: "face-pull",
        sets: 3,
        reps: "12-15",
        restSeconds: 60,
        notes: "Trek naar je voorhoofd en draai je duimen daarbij naar achteren.",
      },
      {
        slug: "kettlebell-halo",
        sets: 2,
        reps: "6/zijde",
        restSeconds: 45,
        notes: "Klein gewicht, cirkel dicht om je hoofd en houd je ribben laag.",
      },
      {
        slug: "scapular-pull-ups",
        sets: 2,
        reps: "8",
        restSeconds: 45,
        notes: "Alleen je schouderbladen bewegen, je armen blijven gestrekt.",
      },
      {
        slug: "thread-the-needle",
        sets: 2,
        reps: "8/zijde",
        restSeconds: 30,
        notes: "Draai vanuit je bovenrug, niet vanuit je onderrug.",
      },
      {
        slug: "doorway-chest-stretch",
        sets: 2,
        reps: "30s/zijde",
        restSeconds: 30,
        notes: "Voel de rek in je borst, niet vooraan in je schouder.",
      },
    ],
  },
  // Tegenwicht voor een dag zitten: nek, borst, bovenrug en heupen, plus een
  // beetje bilspieractivatie. Kort genoeg om echt naast je bureau te doen.
  {
    key: "bureaupauze-10",
    name: "Bureaupauze 10 min",
    description: "Tien minuten tegenwicht voor een dag zitten: nek, borst, bovenrug en heupen weer los.",
    goals: ["mobility", "health", "rehab"],
    badges: ["mobility", "beginner"],
    minutes: 10,
    level: "beginner",
    photoSlug: "dumbbell-travel-30min",
    items: [
      {
        slug: "neck-side-stretch",
        sets: 2,
        reps: "30s/zijde",
        restSeconds: 10,
        notes: "Laat je andere schouder zakken en trek niet aan je hoofd. Stop bij tintelingen in je arm.",
      },
      {
        slug: "doorway-chest-stretch",
        sets: 2,
        reps: "45s",
        restSeconds: 15,
        notes: "Onderarmen tegen de deurpost, ellebogen op schouderhoogte. Stap rustig door, niet doorveren.",
      },
      {
        slug: "kneeling-wrist-stretch",
        sets: 2,
        reps: "30s",
        restSeconds: 10,
        notes: "Voor onderarmen die de hele dag typen. Verplaats je gewicht heel geleidelijk naar achteren.",
      },
      {
        slug: "cat-cow",
        sets: 2,
        reps: "10 ademhalingen",
        restSeconds: 10,
        notes: "Beweeg op je adem: uitademen bol, inademen hol. De beweging komt uit je hele rug.",
      },
      {
        slug: "thread-the-needle-flow",
        sets: 2,
        reps: "8/zijde",
        restSeconds: 10,
        notes: "De draai komt uit je bovenrug, je heupen blijven boven je knieën staan.",
      },
      {
        slug: "kneeling-hip-flexor-stretch",
        sets: 2,
        reps: "45s/zijde",
        restSeconds: 15,
        notes: "Knijp eerst je bil aan en kantel je bekken licht onder je, schuif pas daarna naar voren.",
      },
      {
        slug: "glute-bridge",
        sets: 2,
        reps: "15",
        restSeconds: 20,
        notes: "Zitten zet je bilspieren op slaapstand. Knijp bovenin een tel aan en duw vanuit je hielen.",
      },
      {
        slug: "bodyweight-squat",
        sets: 2,
        reps: "10",
        restSeconds: 20,
        notes: "Sta op en beweeg je hele lichaam nog even door, zo diep als comfortabel voelt.",
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Yoga
  // -------------------------------------------------------------------------
  // Surya Namaskara A en B zoals ze de Ashtanga Vinyasa-praktijk van
  // K. Pattabhi Jois openen. Elke Ashtanga-les ter wereld begint al decennia met
  // vijf ronden A en drie ronden B.
  {
    key: "zonnegroet-a-b",
    name: "Zonnegroet A en B",
    description:
      "De klassieke Surya Namaskar uit Ashtanga yoga: vijf ronden zonnegroet A en daarna drie ronden B, op je adem.",
    goals: ["mobility", "conditioning", "health"],
    badges: ["beginner", "mobility"],
    minutes: 20,
    level: "beginner",
    photoSlug: "home-bodyweight-beginner",
    items: [
      {
        slug: "mountain-pose",
        sets: 1,
        reps: "30s",
        restSeconds: 0,
        notes: "Samasthiti: sta stil en vind je ademritme, ongeveer vijf ademhalingen.",
      },
      {
        slug: "standing-forward-fold",
        sets: 5,
        reps: "1",
        restSeconds: 0,
        notes: "Eén ronde per set: uitademen terwijl je vanuit je heupen naar voren vouwt.",
      },
      {
        slug: "standing-forward-fold-to-half-lift",
        sets: 5,
        reps: "1",
        restSeconds: 0,
        notes: "Inademen, rug lang, blik schuin naar voren.",
      },
      {
        slug: "high-plank",
        sets: 5,
        reps: "1",
        restSeconds: 0,
        notes: "Staat hier voor chaturanga: zak alleen zo diep als je gecontroleerd aankunt.",
      },
      {
        slug: "upward-dog",
        sets: 5,
        reps: "1",
        restSeconds: 0,
        notes: "Inademen, borst open, schouders weg van je oren.",
      },
      {
        slug: "downward-dog",
        sets: 5,
        reps: "30s",
        restSeconds: 30,
        notes: "De enige lange houding in zonnegroet A: vijf ademhalingen.",
      },
      {
        slug: "chair-pose",
        sets: 3,
        reps: "30s",
        restSeconds: 0,
        notes: "Hier begint zonnegroet B: knieën achter je tenen, gewicht op je hielen.",
      },
      {
        slug: "warrior-one",
        sets: 3,
        reps: "30s",
        restSeconds: 30,
        notes: "Elke ronde een keer links en een keer rechts.",
      },
    ],
  },
  // Opbouw van een gewone vinyasa-les: opwarmen op de adem, staande houdingen,
  // dan heupopeners en een lange eindontspanning.
  {
    key: "vinyasa-flow-35",
    name: "Vinyasa flow 35 min",
    description: "Een doorstromende yogales van staande krijgershoudingen naar heupopeners.",
    goals: ["mobility", "stability", "health"],
    badges: ["mobility"],
    minutes: 35,
    level: "intermediate",
    photoSlug: "home-bodyweight-beginner",
    items: [
      {
        slug: "cat-cow",
        sets: 3,
        reps: "8 ademhalingen",
        restSeconds: 0,
        notes: "Beweeg mee met je adem: inademen hol, uitademen bol. Dit is de opwarming.",
      },
      {
        slug: "downward-dog-to-upward-dog",
        sets: 3,
        reps: "6",
        restSeconds: 15,
        notes: "De vinyasa-overgang zelf. Duw de grond actief weg en houd je schouders van je oren af.",
      },
      {
        slug: "warrior-two",
        sets: 2,
        reps: "45s/zijde",
        restSeconds: 15,
        notes: "Voorste knie recht boven je enkel, achterste voet blijft plat op de mat.",
      },
      {
        slug: "extended-side-angle",
        sets: 2,
        reps: "40s/zijde",
        restSeconds: 15,
        notes: "Komt direct uit Warrior II: onderarm op je voorste dijbeen, bovenste arm lang over je oor.",
      },
      {
        slug: "triangle-pose",
        sets: 2,
        reps: "40s/zijde",
        restSeconds: 15,
        notes: "Onderste hand op je scheenbeen of enkel, nooit op de knie zelf. Lengte gaat voor diepte.",
      },
      {
        slug: "tree-pose",
        sets: 2,
        reps: "45s/zijde",
        restSeconds: 15,
        notes: "Voet op je kuit of bovenbeen, nooit tegen de zijkant van je knie. Kijk naar een vast punt.",
      },
      {
        slug: "pigeon-stretch",
        sets: 1,
        reps: "90s/zijde",
        restSeconds: 30,
        notes: "Houd je achterste heup naar de mat gericht. Voel je het in je knie, trek je scheenbeen dan schuiner.",
      },
      {
        slug: "supine-spinal-twist",
        sets: 1,
        reps: "60s/zijde",
        restSeconds: 15,
        notes: "Beide schouders blijven op de mat. Draai alleen zover als je schouder kan blijven liggen.",
      },
      {
        slug: "savasana",
        sets: 1,
        reps: "180s",
        restSeconds: 0,
        notes: "Drie minuten stilliggen. Niets doen is hier de oefening.",
      },
    ],
  },
  // Korte ochtendflow. Vlak na het opstaan zitten de tussenwervelschijven het
  // volst, dus begint deze reeks klein en zonder diep voorover buigen.
  {
    key: "ochtendflow-15",
    name: "Ochtendflow 15 min",
    description: "Een korte, rustige flow die je wervelkolom, heupen en schouders wakker maakt na de nacht.",
    goals: ["mobility", "health"],
    badges: ["beginner", "mobility"],
    minutes: 15,
    level: "beginner",
    photoSlug: "dumbbell-travel-30min",
    items: [
      {
        slug: "cat-cow",
        sets: 3,
        reps: "8 ademhalingen",
        restSeconds: 0,
        notes: "Begin klein en buig nog niet diep voorover, je rug is vlak na het opstaan het stijfst.",
      },
      {
        slug: "childs-pose",
        sets: 1,
        reps: "60s",
        restSeconds: 15,
        notes: "Knieën uit elkaar, adem in je rug. Voelt je onderrug stijf, blijf dan wat hoger op je handen.",
      },
      {
        slug: "puppy-pose",
        sets: 2,
        reps: "45s",
        restSeconds: 15,
        notes: "Heupen boven je knieën, borst zakt richting de mat. Je voelt het tussen je schouderbladen.",
      },
      {
        slug: "downward-dog",
        sets: 3,
        reps: "5 ademhalingen",
        restSeconds: 15,
        notes: "Buig je knieën gerust. Een lange rug is belangrijker dan gestrekte benen.",
      },
      {
        slug: "downward-dog-to-low-lunge",
        sets: 2,
        reps: "5/zijde",
        restSeconds: 15,
        notes: "Stap je voet naast je hand. Lukt dat niet, pak dan je enkel even beet.",
      },
      {
        slug: "low-lunge",
        sets: 1,
        reps: "45s/zijde",
        restSeconds: 20,
        notes: "Span de bil van je achterste been aan, dan komt de rek in je heup en niet in je onderrug.",
      },
      {
        slug: "standing-side-bend-flow",
        sets: 2,
        reps: "6/zijde",
        restSeconds: 10,
        notes: "Rustig van links naar rechts, geen zwiepende bewegingen.",
      },
      {
        slug: "mountain-pose",
        sets: 1,
        reps: "60s",
        restSeconds: 0,
        notes: "Sta stil, voeten heupbreed, en neem tien rustige ademhalingen.",
      },
    ],
  },
  // Herstelyoga gericht op precies datgene wat zwaar tillen vastzet: heupbuigers
  // van squatten en deadliften, lats en borst van overhead drukken en bankdrukken.
  {
    key: "yoga-na-krachttraining",
    name: "Yoga na krachttraining",
    description: "Herstelyoga die precies losmaakt wat squatten, deadliften en bankdrukken vastzetten.",
    goals: ["mobility", "rehab", "health"],
    badges: ["mobility", "rehab"],
    minutes: 25,
    level: "beginner",
    photoSlug: "mobility-warm-up-10min",
    items: [
      {
        slug: "low-lunge",
        sets: 2,
        reps: "60s/zijde",
        restSeconds: 20,
        notes: "Voor je heupbuigers. Span de bil van je achterste been aan, anders zakt de rek weg in je onderrug.",
      },
      {
        slug: "lizard-stretch",
        sets: 1,
        reps: "60s/zijde",
        restSeconds: 30,
        notes: "Zak op je onderarmen als dat lukt. Voelt het scherp in je lies, kom dan terug op je handen.",
      },
      {
        slug: "bench-figure-4-glute-stretch",
        sets: 2,
        reps: "45s/zijde",
        restSeconds: 20,
        notes: "Enkel over de knie, borst rechtop. Knievriendelijker dan de duif.",
      },
      {
        slug: "banded-lat-stretch",
        sets: 2,
        reps: "45s/zijde",
        restSeconds: 20,
        notes: "Korte lats trekken je arm omlaag bij overhead drukken. Hang rustig, laat je ribben niet uitwaaieren.",
      },
      {
        slug: "sphinx-pose",
        sets: 2,
        reps: "45s",
        restSeconds: 20,
        notes: "Tegenwicht voor bankdrukken. Duw vanuit je onderarmen met lage schouders.",
      },
      {
        slug: "standing-calf-stretch",
        sets: 2,
        reps: "45s/zijde",
        restSeconds: 20,
        notes: "Korte kuiten beperken je squatdiepte. Hiel op de grond, achterste been gestrekt, niet veren.",
      },
      {
        slug: "supine-spinal-twist",
        sets: 1,
        reps: "60s/zijde",
        restSeconds: 15,
        notes: "Schouders blijven op de mat, laat je knieën zakken zonder te duwen.",
      },
      {
        slug: "legs-up-the-wall",
        sets: 1,
        reps: "180s",
        restSeconds: 0,
        notes: "Drie minuten met je benen tegen de muur, dat brengt je hartslag omlaag.",
      },
    ],
  },
  // Yin yoga: lange, passieve houdingen van anderhalf tot vijf minuten waarin je
  // de spieren juist ontspant, zodat de rek in het bindweefsel terechtkomt.
  {
    key: "yin-avondsessie",
    name: "Yin avondsessie",
    description:
      "Lange, passieve houdingen van anderhalf tot vijf minuten die je zenuwstelsel tot rust brengen voor het slapen.",
    goals: ["mobility", "health"],
    badges: ["beginner", "mobility"],
    minutes: 35,
    level: "beginner",
    photoSlug: "mobility-warm-up-10min",
    items: [
      {
        slug: "childs-pose",
        sets: 1,
        reps: "120s",
        restSeconds: 30,
        notes: "Twee minuten. Zachte start: laat je adem naar je rug zakken.",
      },
      {
        slug: "sphinx-pose",
        sets: 1,
        reps: "120s",
        restSeconds: 30,
        notes: "Twee minuten. Milde backbend, je onderarmen doen het werk.",
      },
      {
        slug: "pigeon-stretch",
        sets: 2,
        reps: "150s",
        restSeconds: 30,
        notes: "Tweeënhalve minuut per kant. Leg een kussen onder je heup als dat prettiger zit.",
      },
      {
        slug: "butterfly-stretch",
        sets: 1,
        reps: "180s",
        restSeconds: 30,
        notes: "Drie minuten. Voeten los van je bekken, laat je rug rustig rond worden.",
      },
      {
        slug: "seated-straddle-stretch",
        sets: 1,
        reps: "180s",
        restSeconds: 30,
        notes: "Drie minuten. In yin heet deze houding dragonfly.",
      },
      {
        slug: "supine-spinal-twist",
        sets: 2,
        reps: "120s",
        restSeconds: 30,
        notes: "Twee minuten per kant, je schouders blijven op de mat.",
      },
      {
        slug: "happy-baby",
        sets: 1,
        reps: "90s",
        restSeconds: 30,
        notes: "Anderhalve minuut. Trek zachtjes aan de buitenkant van je voeten.",
      },
      {
        slug: "legs-up-the-wall",
        sets: 1,
        reps: "300s",
        restSeconds: 0,
        notes: "Vijf minuten tegen een muur of de zijkant van een bank.",
      },
      {
        slug: "savasana",
        sets: 1,
        reps: "300s",
        restSeconds: 0,
        notes: "Vijf minuten. Blijf liggen tot je ademhaling vanzelf rustig wordt.",
      },
    ],
  },
  // Kort avondritueel op de grond naast je bed. De verlengde uitademing aan het
  // eind is het stukje dat je systeem naar rust omschakelt.
  {
    key: "slaapritueel-15",
    name: "Slaapritueel 15 min",
    description: "Een kort avondritueel op de grond naast je bed, eindigend met je benen tegen de muur.",
    goals: ["health", "mobility"],
    badges: ["beginner", "mobility"],
    minutes: 15,
    level: "beginner",
    photoSlug: "home-bodyweight-beginner",
    items: [
      {
        slug: "cat-cow",
        sets: 1,
        reps: "10 ademhalingen",
        restSeconds: 10,
        notes: "Langzaam, dit is geen oefening maar het losmaken van een dag zitten.",
      },
      {
        slug: "childs-pose",
        sets: 1,
        reps: "90s",
        restSeconds: 15,
        notes: "Anderhalve minuut. Voorhoofd neer zodat je nek kan loslaten.",
      },
      {
        slug: "knee-to-chest-stretch",
        sets: 1,
        reps: "45s/zijde",
        restSeconds: 10,
        notes: "Trek een knie zacht naar je borst. Dit ontspant je onderrug voor je gaat draaien.",
      },
      {
        slug: "supine-spinal-twist",
        sets: 1,
        reps: "60s/zijde",
        restSeconds: 10,
        notes: "Schouders blijven op de grond. Niet forceren om de vloer te halen.",
      },
      {
        slug: "happy-baby",
        sets: 1,
        reps: "60s",
        restSeconds: 10,
        notes: "Wieg rustig heen en weer. Blijft je onderrug hol, pak dan je knieën in plaats van je voeten.",
      },
      {
        slug: "legs-up-the-wall",
        sets: 1,
        reps: "300s",
        restSeconds: 15,
        notes: "Vijf minuten, de kern van dit ritueel. Voelt het als rek, schuif dan verder van de muur.",
      },
      {
        slug: "savasana",
        sets: 1,
        reps: "180s",
        restSeconds: 0,
        notes: "Adem in op vier tellen, uit op zes. Sta hierna rustig op en pak geen telefoon meer.",
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Pilates
  // -------------------------------------------------------------------------
  // Rustige kennismaking met mat pilates: eerst ademhaling, bekkenkanteling en
  // wervel voor wervel bewegen, voordat de klassieke reeks aan bod komt.
  {
    key: "pilates-mat-basis",
    name: "Pilates mat basis",
    description: "Rustige kennismaking met mat pilates: ademhaling, bekkenkanteling en wervel voor wervel bewegen.",
    goals: ["stability", "mobility", "health"],
    badges: ["beginner", "mobility"],
    minutes: 35,
    level: "beginner",
    photoSlug: "mobility-warm-up-10min",
    items: [
      {
        slug: "pilates-roll-down",
        sets: 3,
        reps: "6",
        restSeconds: 20,
        notes: "Staand beginnen: kin naar je borst en rol wervel voor wervel naar beneden.",
      },
      {
        slug: "cat-cow",
        sets: 2,
        reps: "10",
        restSeconds: 15,
        notes: "Op handen en knieën, beweeg mee op je adem. Dit is losmaken, geen rekken.",
      },
      {
        slug: "glute-bridge",
        sets: 3,
        reps: "10",
        restSeconds: 30,
        notes: "De pelvic curl: rol je rug wervel voor wervel van de mat, niet in een blok omhoog.",
      },
      {
        slug: "dead-bug",
        sets: 3,
        reps: "8/zijde",
        restSeconds: 30,
        notes: "Houd je onderrug licht tegen de mat. Komt hij hol te staan, strek je been dan minder ver uit.",
      },
      {
        slug: "side-plank",
        sets: 2,
        reps: "20s/zijde",
        restSeconds: 30,
        notes: "Op je knieën is de gewone startvariant. Schouder, heup en knie in een lijn.",
      },
      {
        slug: "bird-dog",
        sets: 3,
        reps: "8/zijde",
        restSeconds: 30,
        notes: "Rustig tempo, houd je heupen recht.",
      },
      {
        slug: "locust-pose",
        sets: 2,
        reps: "20s",
        restSeconds: 30,
        notes: "Tegenwicht voor al het buigen. Nek in het verlengde van je rug, niet je hoofd in je nek gooien.",
      },
      {
        slug: "pilates-spine-stretch-forward",
        sets: 2,
        reps: "6",
        restSeconds: 20,
        notes: "Zittend, rol vanaf je kruin naar voren over een denkbeeldige bal. Trek nooit aan je rug.",
      },
      {
        slug: "childs-pose",
        sets: 1,
        reps: "60s",
        restSeconds: 0,
        notes: "Afsluiter. Adem rustig naar je onderrug toe.",
      },
    ],
  },
  // De klassieke matvolgorde van Joseph Pilates, van rompverbinding via
  // wervelmobiliteit naar zij- en steunoefeningen.
  {
    key: "pilates-mat-klassiek",
    name: "Pilates mat klassiek",
    description:
      "De klassieke matvolgorde van Joseph Pilates, van rompverbinding via wervelmobiliteit naar zijoefeningen.",
    goals: ["stability", "mobility", "health"],
    badges: ["mobility"],
    minutes: 30,
    level: "intermediate",
    photoSlug: "core-finisher-10min",
    items: [
      {
        slug: "dead-bug",
        sets: 2,
        reps: "10/zijde",
        restSeconds: 30,
        notes: "Staat hier voor de Hundred: houd je onderrug tegen de mat.",
      },
      {
        slug: "pilates-roll-down",
        sets: 2,
        reps: "5",
        restSeconds: 30,
        notes: "Rol wervel voor wervel af en weer omhoog.",
      },
      {
        slug: "scissor-kicks",
        sets: 2,
        reps: "10/zijde",
        restSeconds: 30,
        notes: "Benen alleen zo laag als je onderrug plat blijft.",
      },
      {
        slug: "bicycle-crunch",
        sets: 2,
        reps: "10/zijde",
        restSeconds: 30,
        notes: "Dit is de criss-cross uit de klassieke reeks.",
      },
      {
        slug: "pilates-spine-stretch-forward",
        sets: 2,
        reps: "6",
        restSeconds: 30,
        notes: "Zit hoog op je zitbotten en rond je rug bewust.",
      },
      {
        slug: "pilates-saw",
        sets: 2,
        reps: "3/zijde",
        restSeconds: 30,
        notes: "Draai eerst, buig daarna pas naar voren.",
      },
      {
        slug: "pilates-spine-twist",
        sets: 2,
        reps: "5/zijde",
        restSeconds: 30,
        notes: "Blijf lang in je wervelkolom terwijl je draait.",
      },
      {
        slug: "pilates-leg-pull-front",
        sets: 2,
        reps: "8",
        restSeconds: 45,
        notes: "Houd je heupen stil terwijl je been omhoog komt.",
      },
      {
        slug: "pilates-kneeling-side-kick",
        sets: 2,
        reps: "10/zijde",
        restSeconds: 45,
        notes: "Een rechte lijn van je knie tot je schouder.",
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Stretchen
  // -------------------------------------------------------------------------
  // Statisch rekken na afloop, in de dosering waar het onderzoek op uitkomt:
  // 30 tot 60 seconden per spiergroep. Het maakt je op termijn leniger, maar
  // het voorkomt geen spierpijn, dus dat beloven we ook niet.
  {
    key: "stretch-cooldown-15",
    name: "Stretchen na de training",
    description:
      "Twee series van 30 tot 45 seconden per spiergroep na je training, goed voor je lenigheid maar niet tegen spierpijn.",
    goals: ["mobility", "health"],
    badges: ["beginner", "mobility"],
    minutes: 15,
    level: "beginner",
    photoSlug: "mobility-warm-up-10min",
    items: [
      {
        slug: "childs-pose",
        sets: 2,
        reps: "45s",
        restSeconds: 15,
        notes: "Rustige opener voor onderrug en lats, knieën uit elkaar geeft meer ruimte.",
      },
      {
        slug: "supine-spinal-twist",
        sets: 2,
        reps: "30s/zijde",
        restSeconds: 15,
        notes: "Beide schouders blijven op de mat, laat de knie zakken zonder te duwen.",
      },
      {
        slug: "seated-forward-fold",
        sets: 2,
        reps: "30s",
        restSeconds: 20,
        notes: "Buig vanuit je heupen, een bolle rug betekent dat je te ver wilt.",
      },
      {
        slug: "kneeling-hip-flexor-stretch",
        sets: 2,
        reps: "30s/zijde",
        restSeconds: 20,
        notes: "Knijp eerst de bil van je achterste been aan, dan pas voel je de heupbuiger.",
      },
      {
        slug: "standing-quad-stretch",
        sets: 2,
        reps: "30s/zijde",
        restSeconds: 20,
        notes: "Knie naast je andere knie houden, niet naar buiten laten zwaaien.",
      },
      {
        slug: "standing-calf-stretch",
        sets: 2,
        reps: "30s/zijde",
        restSeconds: 20,
        notes: "Hiel op de grond, achterste knie gestrekt, tenen recht vooruit.",
      },
      {
        slug: "doorway-chest-stretch",
        sets: 2,
        reps: "30s",
        restSeconds: 20,
        notes: "Elleboog op schouderhoogte, stap rustig door, niet in de deurpost hangen.",
      },
      {
        slug: "cross-body-shoulder-stretch",
        sets: 2,
        reps: "30s/zijde",
        restSeconds: 15,
        notes: "Trek boven de elleboog, nooit aan het gewricht zelf.",
      },
    ],
  },
  // Gericht op wat vastzet van veel duwwerk en van bureauwerk: borst, lats,
  // schouders, nek en polsen.
  {
    key: "stretch-bovenlichaam",
    name: "Bovenlichaam stretchen",
    description: "Borst, lats, schouders en nek losmaken, precies de plekken die vastzetten van bankdrukken en bureauwerk.",
    goals: ["mobility", "health", "rehab"],
    badges: ["mobility", "rehab"],
    minutes: 20,
    level: "beginner",
    photoSlug: "dumbbell-travel-30min",
    items: [
      {
        slug: "doorway-chest-stretch",
        sets: 3,
        reps: "45s",
        restSeconds: 20,
        notes: "Elleboog op schouderhoogte, borst open, je rug blijft neutraal.",
      },
      {
        slug: "banded-lat-stretch",
        sets: 2,
        reps: "45s/zijde",
        restSeconds: 20,
        notes: "Band hoog vast, zak terug in je heupen en laat je zij lang worden.",
      },
      {
        slug: "thread-the-needle",
        sets: 2,
        reps: "45s/zijde",
        restSeconds: 20,
        notes: "Draai vanuit je borstwervels, duw niet met je onderste schouder.",
      },
      {
        slug: "puppy-pose",
        sets: 2,
        reps: "45s",
        restSeconds: 20,
        notes: "Heupen boven je knieën, borst richting de mat, niet doorzakken in je lage rug.",
      },
      {
        slug: "cross-body-shoulder-stretch",
        sets: 2,
        reps: "30s/zijde",
        restSeconds: 15,
        notes: "Trek boven de elleboog vast, nooit aan het gewricht.",
      },
      {
        slug: "overhead-triceps-stretch",
        sets: 2,
        reps: "30s/zijde",
        restSeconds: 15,
        notes: "Ribben laag houden, anders rek je je onderrug in plaats van je triceps.",
      },
      {
        slug: "neck-side-stretch",
        sets: 2,
        reps: "30s/zijde",
        restSeconds: 15,
        notes: "Alleen het gewicht van je hand, nooit trekken en niet tegelijk draaien.",
      },
      {
        slug: "kneeling-wrist-stretch",
        sets: 2,
        reps: "30s",
        restSeconds: 15,
        notes: "Kom langzaam naar achteren, bij tintelingen stop je meteen.",
      },
    ],
  },
  // Lenigheidswerk voor het onderlichaam in de dosering die in de literatuur
  // effect laat zien: drie series van 45 seconden, meerdere keren per week, met
  // zichtbaar resultaat pas na een week of zes.
  {
    key: "lenigheid-onderlichaam",
    name: "Lenigheid onderlichaam",
    description:
      "Hamstrings, heupbuigers en adductoren in series van 45 seconden, met resultaat dat pas na een week of zes zichtbaar is.",
    goals: ["mobility", "health"],
    badges: ["mobility"],
    minutes: 30,
    level: "beginner",
    photoSlug: "home-bodyweight-beginner",
    items: [
      {
        slug: "banded-hamstring-stretch",
        sets: 3,
        reps: "45s/zijde",
        restSeconds: 20,
        notes: "Band om de voet, been gestrekt, het andere been blijft plat op de mat.",
      },
      {
        slug: "kneeling-hip-flexor-stretch",
        sets: 3,
        reps: "45s/zijde",
        restSeconds: 20,
        notes: "Kantel je bekken naar achteren voordat je naar voren komt, anders rek je je onderrug.",
      },
      {
        slug: "butterfly-stretch",
        sets: 3,
        reps: "45s",
        restSeconds: 20,
        notes: "Laat je knieën zakken op hun eigen gewicht, nooit met je handen naar beneden duwen.",
      },
      {
        slug: "seated-straddle-stretch",
        sets: 3,
        reps: "45s",
        restSeconds: 25,
        notes: "Zit op een opgevouwen handdoek en houd je rug lang, buigen doe je vanuit je heupen.",
      },
      {
        slug: "pigeon-stretch",
        sets: 2,
        reps: "45s/zijde",
        restSeconds: 25,
        notes: "Voelt het scherp in de knie, leg dan een kussen onder je heup of sla deze over.",
      },
      {
        slug: "banded-calf-stretch",
        sets: 2,
        reps: "45s/zijde",
        restSeconds: 15,
        notes: "Trek je tenen naar je toe met de band en houd je knie gestrekt.",
      },
      {
        slug: "legs-up-the-wall",
        sets: 1,
        reps: "120s",
        restSeconds: 0,
        notes: "Twee minuten afsluiten met je benen tegen de muur.",
      },
    ],
  },
  // Contract-relax (PNF): span de spier vijf seconden aan, laat volledig los en
  // zak dan pas dieper. In onderzoek de effectiefste rekmethode, en de manier
  // waarop turnsters en dansers hun spagaat opbouwen.
  {
    key: "spagaat-progressie",
    name: "Spagaat opbouwen",
    description: "Contract-relax opbouw richting de spagaat, twee keer per week, en reken op maanden.",
    goals: ["mobility", "sport"],
    badges: ["mobility", "intense"],
    minutes: 30,
    level: "intermediate",
    photoSlug: "mobility-warm-up-10min",
    items: [
      {
        slug: "low-lunge",
        sets: 2,
        reps: "45s/zijde",
        restSeconds: 20,
        notes: "Opener, nog geen contract-relax, zoek alleen rustig de positie op.",
      },
      {
        slug: "kneeling-hip-flexor-stretch",
        sets: 3,
        reps: "30s/zijde",
        restSeconds: 20,
        notes: "Span 5 seconden je bil aan, adem uit en zak dan pas iets dieper.",
      },
      {
        slug: "low-lunge-to-half-split",
        sets: 3,
        reps: "30s/zijde",
        restSeconds: 20,
        notes: "Druk je hiel 5 seconden in de mat, laat los en kom dan verder, rug lang.",
      },
      {
        slug: "pyramid-pose",
        sets: 2,
        reps: "30s/zijde",
        restSeconds: 20,
        notes: "Knie mag licht gebogen, zoek de rek in de hamstring en niet in je onderrug.",
      },
      {
        slug: "butterfly-stretch",
        sets: 3,
        reps: "30s",
        restSeconds: 20,
        notes: "Duw 5 seconden je knieën tegen je handen, laat daarna volledig los.",
      },
      {
        slug: "seated-straddle-stretch",
        sets: 3,
        reps: "45s",
        restSeconds: 25,
        notes: "Span 5 seconden je binnenbenen aan, zak daarna vanuit je heupen naar voren.",
      },
      {
        slug: "wide-legged-forward-fold",
        sets: 2,
        reps: "45s",
        restSeconds: 20,
        notes: "Gewicht iets naar voren, tenen recht vooruit, knieën ontspannen.",
      },
      {
        slug: "garland-pose",
        sets: 2,
        reps: "45s",
        restSeconds: 20,
        notes: "Ellebogen tegen de binnenkant van je knieën, hielen zo laag mogelijk.",
      },
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

/**
 * Groep-instelling van een item, of null als het item losstaat. Een groep telt
 * pas als groep zodra er minstens twee opeenvolgende items in zitten — dezelfde
 * self-healing regel die de schema-editor hanteert (lib/exercise-groups.ts).
 */
export function dayTemplateItemGroup(
  template: MemberDayTemplate,
  item: MemberDayTemplateItem
): MemberDayTemplateGroup | null {
  if (!item.group) return null;
  const members = template.items.filter((i) => i.group === item.group);
  if (members.length < 2) return null;
  return template.groups?.[item.group] ?? null;
}
