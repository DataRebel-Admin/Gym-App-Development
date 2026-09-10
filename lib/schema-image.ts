// Afbeelding bij een trainingsschema — puur, géén `server-only` (idioom
// lib/exercise-types.ts / lib/schema-badges.ts): ook bruikbaar in client-
// componenten en tests.
//
// DRIE LAGEN, in deze volgorde (zie `schemaImage`):
//   1. `WorkoutTemplate.imageUrl`  — eigen upload door de sportschool (wint altijd)
//   2. herkomst-foto               — schema overgenomen uit een RepDB-voorbeeldschema
//   3. sportschoollogo             — het vangnet voor élk eigen schema
//
// Waarom een CODE-registry voor de voorbeeldschema's en géén kolom op
// `LibraryWorkoutTemplate`: de bundel wordt periodiek opnieuw geïmporteerd
// (`npm run library:import`, upsert vanuit de RepDB-bron). Een kolom zou bij
// elke re-import overschreven worden, en de foto's zijn ónze curatie — geen
// dataset-content. Nieuwe foto = één record hieronder + `npm run library:images`.
//
// De bestanden staan als WebP in dezelfde publieke media-container als de
// bibliotheek-media (`LIBRARY_MEDIA_BASE_URL`) onder `images/schema-templates/`,
// bewust in een eigen map: het is géén RepDB-materiaal.

import { libraryMediaUrl } from "@/lib/exercise-library/media";

/**
 * Waar komt het beeld vandaan? Bepaalt hóé het getoond wordt: een foto vult de
 * hele kaart (`object-cover`), een logo staat gecentreerd op een rustige
 * achtergrond (`object-contain`) — een uitgesneden wordmark is geen sfeerbeeld.
 */
export type SchemaImageKind = "photo" | "logo";

export type SchemaImage = {
  url: string;
  kind: SchemaImageKind;
  /** Beschrijvende alt-tekst; leeg bij een logo (dat is decoratief). */
  alt: string;
};

/**
 * Waar het bijsnijden op focust. Standaard laat `sharp` zelf het saillante deel
 * kiezen (`attention`), maar dat faalt op donkere of wijd gekadreerde foto's —
 * bewezen: bij `glutes-focus` hield het alléén de vloer over. Voor die gevallen
 * is `center` het antwoord. Per foto visueel gecontroleerd; wijzig dit niet
 * zonder de uitsnede opnieuw te bekijken.
 */
export type LibraryPhotoFocus = "attention" | "center";

/** Eén gecureerde foto bij een voorbeeldschema of een dag-template-thema. */
export type LibraryTemplatePhoto = {
  /**
   * Sleutel van de foto. Twee soorten, bewust in één registry omdat ze dezelfde
   * opslag, hetzelfde uploadscript en dezelfde 3:2-uitsnede delen:
   *   - de slug van een RepDB-voorbeeldschema (= `LibraryWorkoutTemplate.id`);
   *   - een **`theme-`**-sleutel voor de gecureerde dag-templates
   *     (lib/member-day-templates.ts `photoSlug`). Het voorvoegsel voorkomt dat
   *     een volgende RepDB-bundel per ongeluk een thema-foto overneemt.
   */
  slug: string;
  /** Pexels-foto-id — herkomst; het download-script leidt hier de bron-URL uit af. */
  pexelsId: number;
  /** Wat er op de foto staat (NL) → alt-tekst. */
  alt: string;
  /** Uitsnede-strategie; standaard `attention`. */
  focus?: LibraryPhotoFocus;
};

/**
 * Beeldverhouding van de omslagfoto's: 3:2. Bewust niet 16:9 — de helft van de
 * bronfoto's is staand en verliest bij een bredere uitsnede het onderwerp. De
 * UI (`SchemaCover`) gebruikt dezelfde verhouding, zodat er in de browser niets
 * meer bijgesneden hoeft te worden.
 */
export const SCHEMA_COVER_WIDTH = 1200;
export const SCHEMA_COVER_HEIGHT = 800;
export const SCHEMA_COVER_ASPECT = "3 / 2";

/**
 * Gecureerde foto per voorbeeldschema. Bron: **Pexels** (Pexels-licentie:
 * gratis, commercieel gebruik toegestaan, naamsvermelding niet verplicht).
 * Elke foto is visueel gecontroleerd op inhoud die bij het schema past.
 */
export const LIBRARY_TEMPLATE_PHOTOS: Record<string, LibraryTemplatePhoto> = {
  "full-body-3-day-beginner": {
    slug: "full-body-3-day-beginner",
    pexelsId: 4853682,
    alt: "Trainer begeleidt een sporter bij het squatrek",
  },
  "stronglifts-5x5": {
    slug: "stronglifts-5x5",
    pexelsId: 1552106,
    alt: "Sporter onderin een back squat met een barbell",
  },
  "ppl-6-day-intermediate": {
    slug: "ppl-6-day-intermediate",
    pexelsId: 7289370,
    alt: "Sporter drukt twee dumbbells boven het hoofd",
  },
  "upper-lower-4-day": {
    slug: "upper-lower-4-day",
    pexelsId: 17706037,
    alt: "Sporter aan de lat pulldown-machine",
  },
  "powerlifting-peaking-4-day": {
    slug: "powerlifting-peaking-4-day",
    pexelsId: 949134,
    alt: "Zwaar geladen barbell bij een deadlift",
  },
  "glutes-focus": {
    slug: "glutes-focus",
    pexelsId: 13588102,
    alt: "Sporter diep in een barbell squat",
    // Donkere sportschool: de attention-strategie hield alleen de vloer over.
    focus: "center",
  },
  "dumbbell-only-full-body": {
    slug: "dumbbell-only-full-body",
    pexelsId: 4807549,
    alt: "Sporter maakt een lunge met een dumbbell",
  },
  "dumbbell-travel-30min": {
    slug: "dumbbell-travel-30min",
    pexelsId: 8032754,
    alt: "Trainen met dumbbells op een mat in de huiskamer",
  },
  "home-bodyweight-beginner": {
    slug: "home-bodyweight-beginner",
    pexelsId: 8173430,
    alt: "Squat met eigen lichaamsgewicht op een mat thuis",
  },
  "kettlebell-complex": {
    slug: "kettlebell-complex",
    pexelsId: 13106615,
    alt: "Sporter zwaait een kettlebell in de sportschool",
  },
  "hiit-cardio-20min": {
    slug: "hiit-cardio-20min",
    pexelsId: 7187951,
    alt: "Sporter traint met battle ropes",
  },
  "core-finisher-10min": {
    slug: "core-finisher-10min",
    pexelsId: 9376270,
    alt: "Sporter houdt een plank vast op een mat",
  },
  "mobility-warm-up-10min": {
    slug: "mobility-warm-up-10min",
    pexelsId: 6339393,
    alt: "Sporter rekt zittend op een mat",
    // Staande foto met de sporter in het midden; attention koos de voeten.
    focus: "center",
  },
  "pull-up-progression": {
    slug: "pull-up-progression",
    pexelsId: 9644816,
    alt: "Sporter trekt zich op aan een pull-upstang",
  },
  "push-up-progression": {
    slug: "push-up-progression",
    pexelsId: 4720304,
    alt: "Sporter in de onderste stand van een push-up",
  },

  // --- Thema-covers voor de gecureerde dag-templates -----------------------
  // Elke uitsnede is met sharp op 1200x800 gerenderd en visueel gecontroleerd;
  // wijzig `focus` niet zonder opnieuw te kijken. Bij `theme-treadmill` zoomde
  // `attention` op de romp in waardoor de loopband volledig uit beeld viel,
  // vandaar `center`.
  "theme-yoga-flow": {
    slug: "theme-yoga-flow",
    pexelsId: 8436610,
    alt: "Groep sporters in een zijwaartse yogahouding met een arm omhoog",
    focus: "center",
  },
  "theme-yoga-restorative": {
    slug: "theme-yoga-restorative",
    pexelsId: 6998214,
    alt: "Sporter ligt in savasana op een mat in een schemerige studio",
    focus: "center",
  },
  "theme-pilates-mat": {
    slug: "theme-pilates-mat",
    pexelsId: 4151293,
    alt: "Sporter traint mat pilates met opgetrokken benen",
    focus: "center",
  },
  "theme-stretching-lower": {
    slug: "theme-stretching-lower",
    pexelsId: 6455767,
    alt: "Sporter rekt staand de voorkant van zijn bovenbeen",
    focus: "attention",
  },
  "theme-stretching-upper": {
    slug: "theme-stretching-upper",
    pexelsId: 6389501,
    alt: "Sporter rekt zijn schouder met de arm voor de borst",
    focus: "center",
  },
  "theme-treadmill": {
    slug: "theme-treadmill",
    pexelsId: 6455848,
    alt: "Sporter rent op een loopband in de sportschool",
    focus: "center",
  },
  "theme-indoor-cycling": {
    slug: "theme-indoor-cycling",
    pexelsId: 4162580,
    alt: "Sporter fietst rustig op een hometrainer",
    focus: "attention",
  },
  "theme-rowing": {
    slug: "theme-rowing",
    pexelsId: 6389869,
    alt: "Sporter midden in de haal op een roeimachine",
    focus: "center",
  },
  "theme-conditioning": {
    slug: "theme-conditioning",
    pexelsId: 14623739,
    alt: "Drie sporters onderin een push-up in de sportschool",
    focus: "center",
  },
  "theme-arms": {
    slug: "theme-arms",
    pexelsId: 4793224,
    alt: "Sporter maakt een biceps curl met twee dumbbells",
    focus: "center",
  },
  "theme-resistance-band": {
    slug: "theme-resistance-band",
    pexelsId: 6339596,
    alt: "Sporter trekt een weerstandsband uit elkaar voor zijn borst",
    focus: "center",
  },
  "theme-desk-mobility": {
    slug: "theme-desk-mobility",
    pexelsId: 5239956,
    alt: "Werkende maakt haar nek los aan haar bureau",
    focus: "center",
  },
  "theme-knee-rehab": {
    slug: "theme-knee-rehab",
    pexelsId: 8846269,
    alt: "Sporter traint met een weerstandsband om de bovenbenen",
    focus: "center",
  },
  "theme-dips-bars": {
    slug: "theme-dips-bars",
    pexelsId: 4803717,
    alt: "Sporter houdt een L-sit vast op de dip-barren",
    focus: "center",
  },
};

/**
 * Doel → terugval-foto, zodat een voorbeeldschema dat (nog) niet in de registry
 * staat — bijvoorbeeld nieuw in een volgende RepDB-bundel — nooit beeldloos in
 * de lijst staat. Bewust hergebruik van bestaande foto's: geen extra assets.
 *
 * Dekt **beide** doel-woordenschatten: de RepDB-goals (`hypertrophy`, `core`, …,
 * op `LibraryWorkoutTemplate.goal`) én onze eigen trainingsdoelen uit
 * lib/training-goals.ts (`muscle`, `conditioning`, …, op `WorkoutTemplate.goal`).
 */
const GOAL_FALLBACK_SLUG: Record<string, string> = {
  // RepDB-vocabulaire
  strength: "stronglifts-5x5",
  hypertrophy: "ppl-6-day-intermediate",
  endurance: "hiit-cardio-20min",
  core: "core-finisher-10min",
  mobility: "mobility-warm-up-10min",
  power: "powerlifting-peaking-4-day",
  rehabilitation: "mobility-warm-up-10min",
  // lib/training-goals.ts
  muscle: "ppl-6-day-intermediate",
  conditioning: "hiit-cardio-20min",
  stability: "core-finisher-10min",
  rehab: "mobility-warm-up-10min",
  sport: "powerlifting-peaking-4-day",
  weight_loss: "hiit-cardio-20min",
  health: "full-body-3-day-beginner",
};

/** Relatieve blob-key van de foto bij een voorbeeldschema-slug. */
export function libraryTemplatePhotoKey(slug: string): string {
  return `images/schema-templates/${slug}.webp`;
}

/** Bron-URL op Pexels — herkomst voor het download-script en de documentatie. */
export function pexelsSourceUrl(pexelsId: number): string {
  return `https://www.pexels.com/photo/${pexelsId}/`;
}

/**
 * Gecureerde foto bij een voorbeeldschema; valt terug op het doel wanneer de
 * slug niet in de registry staat. `null` alleen als ook het doel onbekend is.
 */
export function libraryTemplatePhoto(
  slug: string | null | undefined,
  goal?: string | null
): LibraryTemplatePhoto | null {
  if (slug && LIBRARY_TEMPLATE_PHOTOS[slug]) return LIBRARY_TEMPLATE_PHOTOS[slug];
  const fallback = goal ? GOAL_FALLBACK_SLUG[goal] : null;
  return (fallback && LIBRARY_TEMPLATE_PHOTOS[fallback]) || null;
}

/** Foto bij een voorbeeldschema als toonbaar beeld (absolute URL). */
export function libraryTemplateImage(
  slug: string | null | undefined,
  goal?: string | null
): SchemaImage | null {
  const photo = libraryTemplatePhoto(slug, goal);
  if (!photo) return null;
  const url = libraryMediaUrl(libraryTemplatePhotoKey(photo.slug));
  return url ? { url, kind: "photo", alt: photo.alt } : null;
}

/**
 * De omslagfoto die een **kopie** van een schema meekrijgt (toewijzen aan een
 * lid, dupliceren, of een lid dat een sjabloon van de sportschool overneemt).
 *
 * Een eigen upload gaat mee zoals hij is; een uit de bibliotheek overgenomen
 * schema krijgt zijn geërfde foto **hard meegeschreven**. Bewust NIET
 * `libraryTemplateId` meekopiëren: dat veld is de idempotentie-sleutel van
 * `importLibraryTemplate` — een kopie die 'm draagt zou als "al overgenomen"
 * gelden en de owner naar het verkeerde schema sturen.
 *
 * Levert `null` wanneer er niets te erven valt; de kopie valt dan in de UI terug
 * op het sportschoollogo, precies zoals elk ander eigen schema.
 */
export function coverUrlForCopy(source: SchemaImageCarrier): string | null {
  return (
    source.imageUrl?.trim() ||
    libraryTemplateImage(source.libraryTemplateId, source.goal)?.url ||
    null
  );
}

/** De velden van een schema die het beeld bepalen. */
export type SchemaImageCarrier = {
  /** Eigen upload van de sportschool (`WorkoutTemplate.imageUrl`). */
  imageUrl?: string | null;
  /** Herkomst wanneer het schema uit een RepDB-voorbeeldschema is overgenomen. */
  libraryTemplateId?: string | null;
  /** Trainingsdoel — terugval binnen de foto-registry. */
  goal?: string | null;
};

/** De huisstijlvelden die het vangnet leveren. */
export type SchemaImageBranding = {
  logoUrl?: string | null;
};

/**
 * Het beeld van één schema: eigen upload → herkomst-foto → sportschoollogo.
 * `null` betekent "toon de neutrale accent-achtergrond" (geen logo ingesteld).
 *
 * Let op de volgorde: een eigen upload wint áltijd, ook bij een overgenomen
 * voorbeeldschema — de sportschool heeft dan bewust een eigen beeld gekozen.
 */
export function schemaImage(
  template: SchemaImageCarrier,
  branding?: SchemaImageBranding | null
): SchemaImage | null {
  const own = template.imageUrl?.trim();
  if (own) return { url: own, kind: "photo", alt: "" };

  if (template.libraryTemplateId) {
    const inherited = libraryTemplateImage(template.libraryTemplateId, template.goal);
    if (inherited) return inherited;
  }

  const logo = branding?.logoUrl?.trim();
  if (logo) return { url: logo, kind: "logo", alt: "" };

  return null;
}
