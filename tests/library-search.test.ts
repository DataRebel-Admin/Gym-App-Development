import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeSearchText,
  scoreLibraryExercise,
  rankLibraryMatches,
  expandQuery,
  searchPickerMatches,
  disciplineTerms,
  NL_QUERY_TERMS,
  type SearchableLibraryExercise,
} from "../lib/exercise-library/search-text";

const LIB: SearchableLibraryExercise[] = [
  { id: "bench-press", names: ["Bench Press"], synonyms: ["chest press", "flat bench"] },
  { id: "incline-bench-press", names: ["Incline Bench Press"], synonyms: [] },
  { id: "dumbbell-curl", names: ["Dumbbell Curl"], synonyms: ["db curl"] },
  { id: "squat", names: ["Squat"], synonyms: ["back squat"] },
  { id: "front-squat", names: ["Front Squat"], synonyms: [] },
  { id: "lat-pulldown", names: ["Lat Pulldown"], synonyms: ["pull down"] },
  { id: "deadlift", names: ["Deadlift"], synonyms: [] },
  { id: "leg-press", names: ["Leg Press"], synonyms: [] },
];

// --- normalisatie -----------------------------------------------------------

test("normalizeSearchText: kleine letters, diacritics weg, -/_ als spatie", () => {
  assert.equal(normalizeSearchText("  Béńch-Press  "), "bench press");
  assert.equal(normalizeSearchText("lat_pulldown"), "lat pulldown");
  assert.equal(normalizeSearchText("!!!"), "");
});

// --- matchen ----------------------------------------------------------------

test("woordvolgorde maakt niet uit", () => {
  const ids = rankLibraryMatches("press bench", LIB);
  assert.ok(ids.includes("bench-press"));
  assert.ok(ids.includes("incline-bench-press"));
  assert.ok(!ids.includes("leg-press"));
});

test("prefix per woord matcht (half getypt woord)", () => {
  assert.ok(rankLibraryMatches("dumb cur", LIB).includes("dumbbell-curl"));
});

test("typo binnen de marge matcht (dumbell → dumbbell, deadlfit → deadlift)", () => {
  assert.ok(rankLibraryMatches("dumbell curl", LIB).includes("dumbbell-curl"));
  assert.ok(rankLibraryMatches("deadlfit", LIB).includes("deadlift"));
});

test("korte woorden gokken niet op typo's", () => {
  // "cral" (4 letters) mag niet fuzzy op "curl" matchen.
  assert.ok(!rankLibraryMatches("cral", LIB).includes("dumbbell-curl"));
});

test("synoniemen matchen als substring, niet alleen exact", () => {
  assert.ok(rankLibraryMatches("chest", LIB).includes("bench-press"));
  assert.ok(rankLibraryMatches("db", LIB).includes("dumbbell-curl"));
});

test("aan elkaar getypt matcht (benchpress → bench press)", () => {
  assert.ok(rankLibraryMatches("benchpress", LIB).includes("bench-press"));
});

test("de id zelf matcht nooit (catalogus-cuids mogen geen valse hits geven)", () => {
  const catalogish: SearchableLibraryExercise[] = [
    { id: "clxdb00012press", names: ["Squat"], synonyms: [] },
  ];
  assert.deepEqual(rankLibraryMatches("press", catalogish), []);
  assert.deepEqual(rankLibraryMatches("db", catalogish), []);
});

test("elk zoekwoord moet ergens raken; onzin levert niets op", () => {
  assert.deepEqual(rankLibraryMatches("bench xyzzy", LIB), []);
  assert.deepEqual(rankLibraryMatches("xylofoon", LIB), []);
  assert.deepEqual(rankLibraryMatches("!!!", LIB), []);
});

// --- NL-glossarium (query-expansie) -----------------------------------------

test("NL_QUERY_TERMS: elke sleutel is genormaliseerd (anders matcht 'ie nooit)", () => {
  for (const key of Object.keys(NL_QUERY_TERMS)) {
    assert.equal(key, normalizeSearchText(key), `sleutel "${key}"`);
  }
});

test("expandQuery: NL-term levert een Engelse variant, rest van de query blijft", () => {
  assert.ok(expandQuery("bankdrukken").includes("bench press"));
  assert.ok(expandQuery("zware bankdrukken").includes("zware bench press"));
  assert.deepEqual(expandQuery("bench press"), ["bench press"]);
});

test("Nederlandse zoekterm vindt de Engelse oefening", () => {
  assert.equal(rankLibraryMatches("bankdrukken", LIB)[0], "bench-press");
  assert.equal(rankLibraryMatches("kniebuigen", LIB)[0], "squat");
});

test("expandQuery: vulwoorden leveren een gestripte variant op", () => {
  assert.ok(expandQuery("yoga oefeningen").includes("yoga"));
  assert.ok(expandQuery("workout voor benen").includes("benen"));
  // Alles vulwoord → geen lege variant erbij.
  assert.deepEqual(expandQuery("oefeningen"), ["oefeningen"]);
});

test("NL-discipline-/doeltermen expanderen naar de dataset-woordenschat", () => {
  assert.ok(expandQuery("rekken").includes("stretching"));
  assert.ok(expandQuery("lenigheid").includes("mobility"));
  assert.ok(expandQuery("spiermassa").includes("hypertrophy"));
  assert.ok(expandQuery("opwarmen").includes("warm up"));
});

// --- disciplines (yoga/pilates, afgeleid) -----------------------------------

test("disciplineTerms: yoga uit pose-naam of Sanskriet-synoniem", () => {
  assert.deepEqual(disciplineTerms(["Boat Pose", "navasana"]), ["yoga"]);
  assert.deepEqual(disciplineTerms(["Cat-Cow", "marjaryasana bitilasana"]), ["yoga"]);
  assert.deepEqual(disciplineTerms(["Garland Pose", "malasana", "yogi squat"]), ["yoga"]);
});

test("disciplineTerms: pilates uit naam of synoniem, niets bij gewone kracht", () => {
  assert.deepEqual(disciplineTerms(["Pilates Leg Pull Back", "leg pull back"]), ["pilates"]);
  assert.deepEqual(disciplineTerms(["Bicycle Crunch", "pilates criss-cross"]), ["pilates"]);
  assert.deepEqual(disciplineTerms(["Bench Press", "chest press"]), []);
  // "posterior"/"exposed" mogen nooit als "pose" gelden.
  assert.deepEqual(disciplineTerms(["Posterior Chain Raise"]), []);
});

test("zoeken op yoga/pilates/stretching vindt via de meta", () => {
  const withDisciplines: SearchableLibraryExercise[] = [
    { id: "boat-pose", names: ["Boat Pose"], synonyms: ["navasana"], meta: ["yoga", "core"] },
    { id: "pilates-hundred", names: ["Pilates Hundred"], synonyms: [], meta: ["pilates"] },
    { id: "camel-pose", names: ["Camel Pose"], synonyms: ["ustrasana"], meta: ["yoga", "stretching"] },
    { id: "bench-press", names: ["Bench Press"], synonyms: [], meta: ["strength", "chest"] },
  ];
  assert.deepEqual(
    new Set(rankLibraryMatches("yoga", withDisciplines)),
    new Set(["boat-pose", "camel-pose"])
  );
  assert.deepEqual(rankLibraryMatches("yoga oefeningen", withDisciplines).length, 2);
  assert.ok(rankLibraryMatches("pilates", withDisciplines).includes("pilates-hundred"));
  // NL-term via glossarium + meta-categorie.
  assert.deepEqual(rankLibraryMatches("rekken", withDisciplines), ["camel-pose"]);
  assert.ok(rankLibraryMatches("kracht", withDisciplines).includes("bench-press"));
});

// --- meta (spier/materiaal, lager gewicht) ----------------------------------

test("meta matcht, maar een naam-treffer rankt erboven", () => {
  const withMeta: SearchableLibraryExercise[] = [
    { id: "bench-press", names: ["Bench Press"], synonyms: [], meta: ["chest", "barbell"] },
    { id: "chest-fly", names: ["Chest Fly"], synonyms: [], meta: ["chest"] },
  ];
  assert.deepEqual(rankLibraryMatches("chest", withMeta), ["chest-fly", "bench-press"]);
  // NL-spierterm loopt via het glossarium naar dezelfde treffers.
  assert.deepEqual(rankLibraryMatches("borst", withMeta), ["chest-fly", "bench-press"]);
});

// --- picker-helper (schema-editors) -----------------------------------------

test("searchPickerMatches: fuzzy op naam + doelspier, relevantie, limiet", () => {
  const picker = [
    { id: "1", name: "Bench Press", targetMuscle: "Borst" },
    { id: "2", name: "Incline Bench Press", targetMuscle: "Borst" },
    { id: "3", name: "Squat", targetMuscle: "Benen" },
  ];
  // Woordvolgorde + typo.
  assert.deepEqual(
    searchPickerMatches("pres bench", picker, 10).map((i) => i.id),
    ["1", "2"]
  );
  // Doelspier (NL) matcht mee.
  assert.deepEqual(
    searchPickerMatches("borst", picker, 10).map((i) => i.id),
    ["1", "2"]
  );
  // Limiet wordt gerespecteerd, beste eerst.
  assert.deepEqual(
    searchPickerMatches("bench press", picker, 1).map((i) => i.id),
    ["1"]
  );
});

// --- ranking ----------------------------------------------------------------

test("exacte naam-match rankt boven ruimere treffers", () => {
  const ids = rankLibraryMatches("squat", LIB);
  assert.equal(ids[0], "squat");
  assert.ok(ids.includes("front-squat"));
});

test("frase in de naam rankt boven synoniem-match", () => {
  const ids = rankLibraryMatches("bench press", LIB);
  assert.equal(ids[0], "bench-press");
  assert.ok(
    ids.indexOf("bench-press") < ids.indexOf("incline-bench-press"),
    "exacte naam vóór langere naam met dezelfde frase"
  );
});

test("scoreLibraryExercise: null zonder match, hoger voor exacter", () => {
  const squat = LIB.find((e) => e.id === "squat")!;
  const front = LIB.find((e) => e.id === "front-squat")!;
  assert.equal(scoreLibraryExercise("bankdrukken", squat), null);
  const s1 = scoreLibraryExercise("squat", squat)!;
  const s2 = scoreLibraryExercise("squat", front)!;
  assert.ok(s1 > s2);
});

// --- lichaamsregio's, categorieën en soorten --------------------------------

/** Kandidaten zoals de serverlaag ze bouwt: rauwe dataset-waarden + het
 *  Nederlandse label dat de UI toont. */
const REGIONS: SearchableLibraryExercise[] = [
  {
    id: "squat",
    names: ["Squat"],
    synonyms: [],
    meta: ["upper_legs", "Bovenbenen", "strength", "Kracht", "quadriceps", "Quadriceps"],
  },
  {
    id: "calf-raise",
    names: ["Calf Raise"],
    synonyms: [],
    meta: ["lower_legs", "Onderbenen", "strength", "Kracht", "gastrocnemius"],
  },
  {
    id: "bicep-curl",
    names: ["Bicep Curl"],
    synonyms: [],
    meta: ["upper_arms", "Bovenarmen", "strength", "Kracht", "biceps"],
  },
  {
    id: "boat-pose",
    names: ["Boat Pose"],
    synonyms: ["navasana"],
    meta: ["core", "Core", "stretching", "Stretching", "mobility", "yoga"],
  },
  {
    id: "pilates-saw",
    names: ["Pilates Saw"],
    synonyms: [],
    meta: ["core", "Core", "stretching", "Stretching", "pilates"],
  },
];

test("Nederlandse lichaamsregio's vinden de dataset-waarde", () => {
  // De dataset zegt "upper_legs", de gebruiker typt wat de chip toont.
  assert.deepEqual(rankLibraryMatches("bovenbenen", REGIONS), ["squat"]);
  assert.deepEqual(rankLibraryMatches("onderbenen", REGIONS), ["calf-raise"]);
  assert.deepEqual(rankLibraryMatches("bovenarmen", REGIONS), ["bicep-curl"]);
});

test("categorie en soort zijn doorzoekbaar (chip = zoekterm)", () => {
  assert.deepEqual(rankLibraryMatches("yoga", REGIONS), ["boat-pose"]);
  assert.deepEqual(rankLibraryMatches("pilates", REGIONS), ["pilates-saw"]);
  // "rekken" → "stretching" via het glossarium; beide houdingen zijn stretching.
  assert.deepEqual(rankLibraryMatches("rekken", REGIONS).sort(), [
    "boat-pose",
    "pilates-saw",
  ]);
  assert.equal(rankLibraryMatches("kracht", REGIONS).length, 3);
});

test("naam-treffer rankt boven een regio-treffer", () => {
  const ids = rankLibraryMatches("squat", REGIONS);
  assert.equal(ids[0], "squat");
});

test("searchPickerMatches matcht ook op lichaamsdeel en materiaal", () => {
  const picker = [
    {
      id: "1",
      name: "Squat",
      targetMuscle: "Quadriceps",
      bodyPart: "upper_legs",
      equipment: "barbell",
      muscles: ["quadriceps"],
      secondaryMuscles: ["glutes"],
    },
    {
      id: "2",
      name: "Bench Press",
      targetMuscle: "Borst",
      bodyPart: "chest",
      equipment: "barbell",
      muscles: ["pectoralis_major"],
      secondaryMuscles: [],
    },
  ];
  assert.deepEqual(searchPickerMatches("bovenbenen", picker, 10).map((i) => i.id), ["1"]);
  assert.deepEqual(searchPickerMatches("barbell", picker, 10).map((i) => i.id).sort(), ["1", "2"]);
  // Hulpspier telt mee (bilspieren → glutes).
  assert.deepEqual(searchPickerMatches("bilspieren", picker, 10).map((i) => i.id), ["1"]);
});
