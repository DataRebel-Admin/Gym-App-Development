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
} from "../lib/exercise-library/media";
import {
  inferLibraryExerciseType,
  machineTypeFromLibrary,
  difficultyFromLibrary,
  datasetLocalePreference,
  pickLibraryText,
  trainingGoalFromLibrary,
  parseTemplateReps,
  pickJsonName,
} from "../lib/exercise-library/mapping";
import { exerciseSourceOf } from "../lib/exercise-library/source";
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
