import { test } from "node:test";
import assert from "node:assert/strict";
import {
  libraryImageSlug,
  libraryImageKeys,
  libraryImageKey,
  libraryAnimationKey,
  parseImageVariants,
  muscleImageKey,
  equipmentImageKey,
  libraryMediaBaseUrl,
} from "../lib/exercise-library/media";
import { exerciseThumbUrl } from "../lib/exercise-thumb";
import {
  inferLibraryExerciseType,
  machineTypeFromLibrary,
  difficultyFromLibrary,
  datasetLocalePreference,
  pickLibraryText,
  trainingGoalFromLibrary,
  parseTemplateReps,
  pickJsonName,
  bodyPartLabel,
} from "../lib/exercise-library/mapping";
import { exerciseSourceOf, OWN_EXERCISE_WHERE } from "../lib/exercise-library/source";
import { resolveRegion } from "../lib/muscle-map";

// --- media ------------------------------------------------------------------

test("imageAlias wint van id bij bestandsnamen (RepDB-regel)", () => {
  assert.equal(libraryImageSlug({ id: "paused-ohp", imageAlias: "ohp" }), "ohp");
  assert.equal(libraryImageSlug({ id: "bench-press", imageAlias: null }), "bench-press");
  assert.equal(
    libraryImageKey({ id: "paused-ohp", imageAlias: "ohp" }, "classic", "start"),
    "images/classic/ohp-start.webp"
  );
});

test("libraryImageKeys volgt de images-map (start→peak, main voor holds)", () => {
  const bench = { id: "bench-press", images: { classic: ["start", "peak"], flat: ["start", "peak"] } };
  assert.deepEqual(libraryImageKeys(bench), [
    "images/classic/bench-press-start.webp",
    "images/classic/bench-press-peak.webp",
  ]);
  const plank = { id: "plank", images: { flat: ["main"] } };
  // classic ontbreekt → val terug op flat
  assert.deepEqual(libraryImageKeys(plank, "classic"), ["images/flat/plank-main.webp"]);
});

test("parseImageVariants is defensief tegen rommel", () => {
  assert.deepEqual(parseImageVariants(null), {});
  assert.deepEqual(parseImageVariants([1, 2]), {});
  assert.deepEqual(parseImageVariants({ classic: ["start", "onzin"] }), { classic: ["start"] });
});

test("animatie-key alleen bij animation=true, via alias", () => {
  assert.equal(libraryAnimationKey({ id: "x", animation: false }), null);
  assert.equal(
    libraryAnimationKey({ id: "paused-ohp", imageAlias: "ohp", animation: true }),
    "images/animations/ohp.webp"
  );
  assert.equal(muscleImageKey("biceps-brachii.webp"), "images/muscles/biceps-brachii.webp");
  assert.equal(equipmentImageKey(null), null);
});

// --- mapping ----------------------------------------------------------------

test("oefeningstype-inferentie: specifiek wint van generiek", () => {
  assert.equal(inferLibraryExerciseType({ category: "cardio" }), "cardio");
  assert.equal(inferLibraryExerciseType({ category: "stretching", goals: ["mobility"] }), "mobility");
  assert.equal(inferLibraryExerciseType({ category: "stretching", goals: [] }), "stretch");
  assert.equal(inferLibraryExerciseType({ category: "strength", forceType: "static" }), "isometric");
  assert.equal(inferLibraryExerciseType({ category: "strength", bodyPart: "core" }), "core");
  assert.equal(inferLibraryExerciseType({ category: "plyometrics" }), "functional");
  assert.equal(inferLibraryExerciseType({ category: "olympic" }), "strength");
});

test("lichaamsdeel-label: bibliotheek en klassieke catalogus geven hetzelfde label", () => {
  // Beide bronnen komen in één lijst voor (leden-oefeningen) → één chip per
  // lichaamsdeel, anders staat "upper legs" náást "Bovenbenen".
  assert.equal(bodyPartLabel("upper_legs"), "Bovenbenen");
  assert.equal(bodyPartLabel("upper legs"), "Bovenbenen");
  assert.equal(bodyPartLabel("Upper Legs"), "Bovenbenen");
  assert.equal(bodyPartLabel("full_body"), "Hele lichaam");
  // Legacy-eigen termen: "waist" valt samen met bibliotheek-"core".
  assert.equal(bodyPartLabel("waist"), bodyPartLabel("core"));
  assert.equal(bodyPartLabel("cardio"), "Cardio");
  // Onbekende waarde blijft leesbaar (nooit een lege chip), leeg blijft null.
  assert.equal(bodyPartLabel("iets nieuws"), "iets nieuws");
  assert.equal(bodyPartLabel(null), null);
  assert.equal(bodyPartLabel("  "), null);
});

test("machinetype uit materiaal-tags", () => {
  assert.equal(machineTypeFromLibrary("treadmill", ["cardio_machine", "cardio"]), "CARDIO");
  assert.equal(machineTypeFromLibrary("leg_press", ["machine", "legs"]), "KRACHT");
  assert.equal(machineTypeFromLibrary("cable", ["cable"]), "KRACHT");
  assert.equal(machineTypeFromLibrary("barbell", ["free_weight"]), "VRIJE_GEWICHTEN");
  assert.equal(machineTypeFromLibrary("resistance_band", ["band"]), "OVERIG");
  assert.equal(machineTypeFromLibrary(null, null), "OVERIG");
});

test("difficulty/goal-mappings", () => {
  assert.equal(difficultyFromLibrary("beginner"), "BEGINNER");
  assert.equal(difficultyFromLibrary("intermediate"), "GEMIDDELD");
  assert.equal(difficultyFromLibrary("advanced"), "GEVORDERD");
  assert.equal(difficultyFromLibrary(null), null);
  assert.equal(trainingGoalFromLibrary("hypertrophy"), "muscle");
  assert.equal(trainingGoalFromLibrary("rehabilitation"), "rehab");
  assert.equal(trainingGoalFromLibrary("onzin"), null);
});

test("taalvoorkeur: nl→[nl,en], fy volgt nl, onbekend→[en]", () => {
  assert.deepEqual(datasetLocalePreference("NL"), ["nl", "en"]);
  assert.deepEqual(datasetLocalePreference("fy"), ["nl", "en"]);
  assert.deepEqual(datasetLocalePreference("en"), ["en"]);
  assert.deepEqual(datasetLocalePreference("xx"), ["en"]);
});

test("pickLibraryText: voorkeursvolgorde, en-vangnet", () => {
  const rows = [
    { locale: "en", name: "Bench Press" },
    { locale: "de", name: "Bankdrücken" },
  ];
  assert.equal(pickLibraryText(rows, ["nl", "en"])?.name, "Bench Press");
  assert.equal(pickLibraryText(rows, ["de", "en"])?.name, "Bankdrücken");
  assert.equal(pickLibraryText([], ["en"]), null);
});

test("pickJsonName leest {locale: naam} defensief", () => {
  assert.equal(pickJsonName({ en: "Biceps", de: "Bizeps" }, ["de", "en"]), "Bizeps");
  assert.equal(pickJsonName({ en: "Biceps" }, ["nl"]), "Biceps");
  assert.equal(pickJsonName(null, ["en"]), null);
  assert.equal(pickJsonName("raar", ["en"]), null);
});

test("parseTemplateReps: getal, bereik, tijd, AMRAP", () => {
  assert.deepEqual(parseTemplateReps("5"), { reps: 5, note: null });
  assert.deepEqual(parseTemplateReps("8-12"), { reps: 8, note: "8–12 herhalingen" });
  assert.deepEqual(parseTemplateReps("30s"), { reps: 30, note: "30s" });
  assert.deepEqual(parseTemplateReps("10/leg"), { reps: 10, note: "10/leg" });
  assert.deepEqual(parseTemplateReps("AMRAP"), { reps: null, note: "AMRAP" });
});

// --- source -----------------------------------------------------------------

test("herkomst: libraryId → standaard, catalogId → klassiek, geen → eigen", () => {
  assert.equal(exerciseSourceOf({ libraryId: "bench-press" }), "standaard");
  assert.equal(exerciseSourceOf({ catalogId: "0001" }), "klassiek");
  assert.equal(exerciseSourceOf({}), "eigen");
});

// OWN_EXERCISE_WHERE is de query-tegenhanger van `exerciseSourceOf === "eigen"`.
// Regressie: met alleen `catalogId: null` lekte de hele bibliotheek de Eigen-tab
// in en waren bibliotheek-oefeningen via het eigen-formulier muteerbaar.
test("OWN_EXERCISE_WHERE matcht precies de rijen die 'eigen' zijn", () => {
  assert.deepEqual({ ...OWN_EXERCISE_WHERE }, { catalogId: null, libraryId: null });

  const rows = [
    { name: "Rowing", catalogId: null, libraryId: null },
    { name: "Burpee", catalogId: null, libraryId: "burpees" },
    { name: "Barbell squat", catalogId: "0001", libraryId: null },
  ];
  const matches = (r: { catalogId: string | null; libraryId: string | null }) =>
    Object.entries(OWN_EXERCISE_WHERE).every(
      ([k, v]) => r[k as "catalogId" | "libraryId"] === v
    );

  assert.deepEqual(
    rows.filter(matches).map((r) => r.name),
    rows.filter((r) => exerciseSourceOf(r) === "eigen").map((r) => r.name)
  );
  assert.deepEqual(rows.filter(matches).map((r) => r.name), ["Rowing"]);
});

// --- thumbnails (3-weg, bron-bewust) ---------------------------------------

// Dezelfde valkuil als OWN_EXERCISE_WHERE: sinds de bibliotheek dé standaardbron
// is, levert een losse `catalog`-check bij bijna elke oefening géén beeld op.
// `exerciseThumbUrl` is dé lookup — pickers, schema-overzicht én de PDF delen 'm.
test("exerciseThumbUrl: bibliotheek wint van klassiek, klassiek van eigen", () => {
  const libRow = {
    library: { id: "bench-press", imageAlias: null, images: { classic: ["start", "peak"] } },
    catalog: { imageUrl: "https://cdn/oud.jpg", gifUrl: null },
    imageUrls: ["https://blob/eigen.png"],
  };
  assert.equal(
    exerciseThumbUrl(libRow),
    `${libraryMediaBaseUrl()}/images/classic/bench-press-start.webp`
  );

  // Klassiek: imageUrl vóór gifUrl.
  assert.equal(
    exerciseThumbUrl({ library: null, catalog: { imageUrl: "a.jpg", gifUrl: "b.gif" } }),
    "a.jpg"
  );
  assert.equal(
    exerciseThumbUrl({ catalog: { imageUrl: null, gifUrl: "b.gif" } }),
    "b.gif"
  );

  // Eigen oefening: eerste upload. Zonder bron: null (geen beeld-kolom in de PDF).
  assert.equal(exerciseThumbUrl({ imageUrls: ["x.png", "y.png"] }), "x.png");
  assert.equal(exerciseThumbUrl({}), null);
  assert.equal(exerciseThumbUrl({ library: null, catalog: null, imageUrls: [] }), null);
});

// --- muscle-map: RepDB-slugs ------------------------------------------------

test("alle RepDB-spier-slugs resolven naar een regio", () => {
  const slugs = [
    "abductors", "adductors", "anterior_deltoid", "biceps_brachii", "brachialis",
    "brachioradialis", "erector_spinae", "forearms", "forearm_extensors",
    "forearm_flexors", "gastrocnemius", "gluteus_maximus", "gluteus_medius",
    "hamstrings", "hip_flexors", "lateral_deltoid", "latissimus_dorsi",
    "quadratus_lumborum", "obliques", "pectoralis_major", "posterior_deltoid",
    "quadriceps", "rectus_abdominis", "rhomboids", "serratus_anterior",
    "supraspinatus", "soleus", "transverse_abdominis", "trapezius", "triceps_brachii",
  ];
  for (const slug of slugs) {
    assert.notEqual(resolveRegion(slug), null, `geen regio voor ${slug}`);
  }
  assert.equal(resolveRegion("biceps_brachii"), "biceps");
  assert.equal(resolveRegion("latissimus_dorsi"), "lats");
  assert.equal(resolveRegion("gastrocnemius"), "calves");
});
