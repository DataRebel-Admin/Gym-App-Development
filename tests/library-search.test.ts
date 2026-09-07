import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeSearchText,
  scoreLibraryExercise,
  rankLibraryMatches,
  expandQuery,
  searchPickerMatches,
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
