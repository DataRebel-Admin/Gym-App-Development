import { levenshtein } from "../errors";

/**
 * Pure zoek-/matchlogica voor de oefeningen-bibliotheek (géén `server-only`,
 * idioom `exercise-types.ts`) — testbaar zonder DB. De serverlaag
 * (`search.ts`) laadt de kandidaten en laat deze module matchen + ranken.
 *
 * Waarom niet in de Prisma-`where`: `contains` matcht alleen een letterlijke
 * aaneengesloten substring ("press bench" vond "Bench Press" niet) en op een
 * String[]-kolom (synoniemen) kent Prisma alleen exacte element-matches. De
 * bibliotheek is klein (±600 rijen), dus in-memory matchen is goedkoop en
 * maakt woordvolgorde-onafhankelijk zoeken, prefix-match, typo-tolerantie en
 * relevantie-ranking mogelijk.
 */

export type SearchableLibraryExercise = {
  /** Sleutel van de treffer (RepDB-slug of catalogus-id) — wordt zelf NIET
   *  gematcht: een cuid mag nooit per ongeluk een zoekterm raken. Wil je de
   *  slug doorzoekbaar hebben (bibliotheek), zet 'm dan in `names`. */
  id: string;
  /** Doorzoekbare namen (tekst-rijen; alle talen — naamsbeleid houdt ze gelijk). */
  names: string[];
  synonyms: string[];
  /** Spier-/materiaal-/categorienamen: matchen mee, maar met lager gewicht dan
   *  naam en synoniem ("triceps" vindt alle triceps-oefeningen, maar een
   *  naam-treffer rankt erboven). */
  meta?: string[];
};

/**
 * NL→EN-zoektermen (query-expansie). Oefeningnamen zijn bewust Engels
 * (naamsbeleid), dus een Nederlandse zoekterm vond niets. Elke sleutel die als
 * los woord (of frase) in de zoekterm staat levert een extra zoekvariant op
 * met de Engelse vertaling; de best scorende variant wint. **Nieuwe term = één
 * regel.** Sleutels moeten genormaliseerd zijn (kleine letters, geen
 * diacritics) — een test dwingt dat af. De spiertermen dekken ook de klassieke
 * catalogus, die geen Nederlandse namen heeft.
 */
export const NL_QUERY_TERMS: Record<string, string> = {
  // bewegingen
  bankdrukken: "bench press",
  optrekken: "pull up",
  opdrukken: "push up",
  kniebuigen: "squat",
  uitvalspas: "lunge",
  uitvalspassen: "lunge",
  planken: "plank",
  roeien: "row",
  schouderdrukken: "shoulder press",
  kuitheffen: "calf raise",
  heupstoot: "hip thrust",
  "zijwaarts heffen": "lateral raise",
  opstappen: "step up",
  hardlopen: "run",
  fietsen: "bike",
  wandelen: "walk",
  touwtjespringen: "jump rope",
  springtouw: "jump rope",
  // materiaal
  stang: "barbell",
  halter: "dumbbell",
  halters: "dumbbell",
  kabel: "cable",
  kabelmachine: "cable",
  loopband: "treadmill",
  // Apparaten waarvan de Nederlandse naam op het toestel staat maar de slug
  // Engels is; zonder deze regels vond "beenpers" niets (gevonden bij de
  // catalogus-audit).
  beenpers: "leg press",
  beencurl: "leg curl",
  beenextensie: "leg extension",
  borstpers: "chest press",
  crosstrainer: "elliptical",
  hometrainer: "stationary bike",
  roeimachine: "rowing machine",
  // spieren/regio's
  borst: "chest",
  rug: "back",
  schouders: "shoulders",
  benen: "legs",
  kuiten: "calves",
  billen: "glutes",
  bilspieren: "glutes",
  buikspieren: "abs",
  buik: "abs",
  onderrug: "lower back",
  nek: "neck",
  // lichaamsdelen zoals de dataset ze indeelt (RepDB `bodyPart` = `upper_legs`
  // → genormaliseerd "upper legs"; de aanvullende catalogus gebruikt dezelfde
  // woorden). Zonder deze regels vond "bovenbenen" nul oefeningen terwijl de
  // filterchip in de UI wél "Bovenbenen" heet.
  bovenbenen: "upper legs",
  bovenbeen: "upper legs",
  dijbeen: "upper legs",
  dijbenen: "upper legs",
  onderbenen: "lower legs",
  onderbeen: "lower legs",
  bovenarmen: "upper arms",
  bovenarm: "upper arms",
  onderarmen: "lower arms",
  onderarm: "lower arms",
  romp: "core",
  taille: "waist",
  "hele lichaam": "full body",
  "heel lichaam": "full body",
  "volledige lichaam": "full body",
  // disciplines/doelen/categorieën — matchen via de meta (categorie, doelen,
  // tags, oefeningstype), die de serverlaag meegeeft.
  rekken: "stretching",
  strekken: "stretching",
  stretchen: "stretching",
  rekoefening: "stretching",
  rekoefeningen: "stretching",
  lenigheid: "mobility",
  mobiliteit: "mobility",
  kracht: "strength",
  krachttraining: "strength",
  conditie: "cardio",
  uithoudingsvermogen: "endurance",
  spiermassa: "hypertrophy",
  spieropbouw: "hypertrophy",
  explosiviteit: "power",
  herstel: "rehabilitation",
  revalidatie: "rehabilitation",
  opwarmen: "warm up",
  opwarming: "warm up",
  lichaamsgewicht: "bodyweight",
  olympisch: "olympic",
  gewichtheffen: "olympic",
  plyometrie: "plyometrics",
  plyometrisch: "plyometrics",
  sprongkracht: "plyometrics",
};

/**
 * Generieke vulwoorden die in een zoekterm niets toevoegen ("yoga oefeningen",
 * "workout voor benen"). {@link expandQuery} probeert náást de letterlijke
 * invoer ook een variant zonder deze woorden — de best scorende variant wint,
 * dus strippen kan alleen treffers opleveren, nooit kosten.
 */
export const SEARCH_FILLER_WORDS = new Set([
  "oefening",
  "oefeningen",
  "exercise",
  "exercises",
  "workout",
  "workouts",
  "training",
  "voor",
  "de",
  "het",
  "een",
]);

/**
 * Afgeleide discipline-labels ("yoga", "pilates") voor de zoek-meta. RepDB
 * labelt yoga/pilates niet als categorie of tag; herkenbaar zijn ze wél aan de
 * naam ("Boat Pose") en de Sanskriet-synoniemen ("navasana"). Liever een
 * enkele ruime treffer (glute bridge heet óók "bridge pose") dan dat "yoga"
 * niets oplevert. Puur — de serverlaag geeft slug + namen + synoniemen mee.
 */
export function disciplineTerms(texts: string[]): string[] {
  const out = new Set<string>();
  for (const raw of texts) {
    const t = ` ${normalizeSearchText(raw)} `;
    if (t.includes(" pilates ")) out.add("pilates");
    if (
      t.includes(" yoga ") ||
      t.includes(" yogi ") ||
      t.includes(" pose ") ||
      /[a-z]asana\b|\basana /.test(t)
    ) {
      out.add("yoga");
    }
  }
  return [...out];
}

/**
 * Zoekvarianten voor een query: de genormaliseerde invoer zelf, een variant
 * zonder generieke vulwoorden ("yoga oefeningen" → "yoga") plus, per gevonden
 * NL-term, een variant waarin die term door de Engelse tegenhanger is
 * vervangen (woordgrens-veilig via spatie-padding).
 */
export function expandQuery(query: string): string[] {
  const norm = normalizeSearchText(query);
  const variants = new Set<string>(norm ? [norm] : []);
  const stripped = norm
    .split(" ")
    .filter((w) => !SEARCH_FILLER_WORDS.has(w))
    .join(" ");
  if (stripped && stripped !== norm) variants.add(stripped);
  for (const [nl, en] of Object.entries(NL_QUERY_TERMS)) {
    for (const v of [...variants]) {
      const replaced = ` ${v} `.split(` ${nl} `).join(` ${en} `).trim();
      if (replaced && replaced !== v) variants.add(replaced);
    }
  }
  return [...variants];
}

/** Kleine letters, diacritics eruit, koppel-/underscore-tekens → spatie. */
export function normalizeSearchText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[-_/]+/g, " ")
    .replace(/[^a-z0-9 ]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Aantal toegestane tikfouten per zoekwoord (kort woord = geen gok). */
function allowedEdits(token: string): number {
  if (token.length >= 8) return 2;
  if (token.length >= 5) return 1;
  return 0;
}

/**
 * Matcht één zoekwoord tegen één woord uit de tekst: prefix ("dumb" →
 * "dumbbell") of typo binnen de edit-marge ("dumbell" → "dumbbell", ook als
 * de typo een afgekapt woord is: vergelijk dan tegen de woord-prefix).
 */
function fuzzyWordMatch(token: string, word: string): boolean {
  if (word.startsWith(token)) return true;
  const edits = allowedEdits(token);
  if (edits === 0) return false;
  if (Math.abs(word.length - token.length) <= edits && levenshtein(token, word) <= edits) {
    return true;
  }
  return (
    word.length > token.length &&
    levenshtein(token, word.slice(0, token.length + 1)) <= edits
  );
}

/** Compacte vorm ("bench press" → "benchpress") voor aan-elkaar-typers. */
const COMPACT_MIN_TOKEN = 5;

type Field = { text: string; compact: string; words: string[] };

function toField(raw: string): Field {
  const text = normalizeSearchText(raw);
  return { text, compact: text.replace(/ /g, ""), words: text.split(" ") };
}

/** Beste match-kwaliteit van één zoekwoord binnen één veld (0 = geen match). */
function tokenQuality(token: string, field: Field): number {
  if (field.text.includes(token)) return 100;
  if (token.length >= COMPACT_MIN_TOKEN && field.compact.includes(token)) return 60;
  if (field.words.some((w) => fuzzyWordMatch(token, w))) return 55;
  return 0;
}

type Candidate = {
  names: Field[];
  synonyms: Field[];
  meta: Field[];
  lengthTiebreak: number;
};

function toCandidate(ex: SearchableLibraryExercise): Candidate {
  const names = ex.names.map(toField);
  const shortest = Math.min(...names.map((n) => n.text.length || Infinity));
  return {
    names,
    synonyms: ex.synonyms.map(toField),
    meta: (ex.meta ?? []).map(toField),
    lengthTiebreak: Number.isFinite(shortest) ? shortest * 0.1 : 0,
  };
}

/** Score van één (al genormaliseerde) zoekvariant tegen één kandidaat. */
function scoreVariant(q: string, cand: Candidate): number | null {
  const tokens = q.split(" ").filter(Boolean);
  if (tokens.length === 0) return null;

  // Frase-bonussen: de hele zoekterm in volgorde aanwezig (naam of synoniem).
  let phrase = 0;
  for (const n of cand.names) {
    if (n.text === q) phrase = Math.max(phrase, 400);
    else if (n.text.startsWith(q)) phrase = Math.max(phrase, 300);
    else if (n.text.includes(q)) phrase = Math.max(phrase, 250);
  }
  for (const s of cand.synonyms) {
    if (s.text === q) phrase = Math.max(phrase, 350);
    else if (s.text.startsWith(q)) phrase = Math.max(phrase, 240);
    else if (s.text.includes(q)) phrase = Math.max(phrase, 200);
  }
  if (phrase > 0) return phrase - cand.lengthTiebreak;

  // Los per zoekwoord: beste kwaliteit over alle velden. Synoniem telt lichter
  // dan de naam, spier/materiaal (meta) weer lichter dan het synoniem.
  let score = 0;
  for (const token of tokens) {
    let best = 0;
    for (const n of cand.names) best = Math.max(best, tokenQuality(token, n));
    for (const s of cand.synonyms) best = Math.max(best, tokenQuality(token, s) * 0.8);
    for (const m of cand.meta) best = Math.max(best, tokenQuality(token, m) * 0.6);
    if (best === 0) return null;
    score += best;
  }

  // Staat de héle zoekterm als frase in één meta-veld, dan is dat een echte
  // treffer op dat label en geen toevallige spreiding over losse velden:
  // "lower legs" hoort bij het lichaamsdeel, niet bij een oefening die
  // "upper legs" is met een tag "lower back safe". Bewust lager dan een
  // frase in naam/synoniem, en `Math.max` (geen vroege return) zodat een
  // sterkere naam-treffer altijd wint.
  let metaPhrase = 0;
  for (const m of cand.meta) {
    if (m.text === q) metaPhrase = Math.max(metaPhrase, 180);
    else if (m.text.includes(q)) metaPhrase = Math.max(metaPhrase, 150);
  }
  return Math.max(score, metaPhrase) - cand.lengthTiebreak;
}

/**
 * Relevantie-score van één oefening voor de zoekterm; `null` = geen match
 * (élk zoekwoord moet ergens raken). Hogere score = relevanter: een exacte of
 * frase-match op de naam wint van losse woorden, naam wint van synoniem wint
 * van spier/materiaal, en een korte naam wint bij gelijke kwaliteit (tiebreak)
 * van een lange. Nederlandse zoektermen worden via {@link expandQuery}
 * meegeprobeerd; de best scorende variant telt.
 */
export function scoreLibraryExercise(
  query: string,
  ex: SearchableLibraryExercise
): number | null {
  return scoreVariants(expandQuery(query), toCandidate(ex));
}

/** Beste score over de al berekende zoekvarianten (zie {@link expandQuery}). */
function scoreVariants(variants: string[], cand: Candidate): number | null {
  let best: number | null = null;
  for (const variant of variants) {
    const s = scoreVariant(variant, cand);
    if (s != null && (best == null || s > best)) best = s;
  }
  return best;
}

/**
 * Alle matches voor de zoekterm, gesorteerd op relevantie (beste eerst,
 * tiebreak op id voor een stabiele volgorde). Lege/onbruikbare zoekterm → [].
 *
 * De zoekvarianten (NL→EN-expansie) worden **één keer** berekend en daarna
 * tegen elke kandidaat gescoord — per kandidaat expanderen liep bij ±600
 * oefeningen tegen de honderd glossarium-vervangingen per rij op.
 */
export function rankLibraryMatches(
  query: string,
  exercises: SearchableLibraryExercise[]
): string[] {
  const variants = expandQuery(query);
  if (variants.length === 0) return [];
  return exercises
    .map((ex) => ({ id: ex.id, score: scoreVariants(variants, toCandidate(ex)) }))
    .filter((m): m is { id: string; score: number } => m.score != null)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .map((m) => m.id);
}

/**
 * Client-side variant voor de oefening-pickers (owner-SchemaEditor + mobiele
 * lid-builder): matcht op naam + spier/lichaamsdeel/materiaal met dezelfde
 * fuzzy regels en geeft de items op relevantie terug (max `limit`). Vervangt
 * de kale `name.includes(q)`-filter, zodat typo's en woordvolgorde daar ook
 * werken.
 *
 * De extra velden zijn optioneel maar wél de reden dat "bovenbenen" of
 * "triceps" hier iets vindt: `AvailableExercise` draagt ze al (gevuld door
 * `getPickerExercises`). `bodyPart` is de rauwe dataset-waarde (`upper_legs`
 * → "upper legs"); de Nederlandse invoer landt daarop via
 * {@link NL_QUERY_TERMS}, dus er is hier geen labeltabel nodig.
 */
export function searchPickerMatches<
  T extends {
    id: string;
    name: string;
    targetMuscle?: string | null;
    muscles?: string[];
    secondaryMuscles?: string[];
    bodyPart?: string | null;
    equipment?: string | null;
  }
>(query: string, items: T[], limit: number): T[] {
  const ranked = rankLibraryMatches(
    query,
    items.map((i) => ({
      id: i.id,
      names: [i.name],
      synonyms: [],
      meta: [
        i.targetMuscle,
        ...(i.muscles ?? []),
        ...(i.secondaryMuscles ?? []),
        i.bodyPart,
        i.equipment,
      ].filter((v): v is string => Boolean(v)),
    }))
  );
  const byId = new Map(items.map((i) => [i.id, i]));
  const out: T[] = [];
  for (const id of ranked) {
    const item = byId.get(id);
    if (item) out.push(item);
    if (out.length >= limit) break;
  }
  return out;
}
