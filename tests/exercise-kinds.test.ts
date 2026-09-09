import test from "node:test";
import assert from "node:assert/strict";
import { exerciseKinds, EXERCISE_KIND_ORDER } from "../lib/exercise-library/kinds";

test("type bepaalt de grove soort", () => {
  assert.deepEqual(exerciseKinds({ exerciseType: "strength", names: ["Bench Press"] }), ["strength"]);
  assert.deepEqual(exerciseKinds({ exerciseType: "isometric", names: ["Plank"] }), ["strength"]);
  assert.deepEqual(exerciseKinds({ exerciseType: "endurance", names: ["Rowing"] }), ["cardio"]);
  assert.deepEqual(exerciseKinds({ exerciseType: "core", names: ["Crunch"] }), ["core"]);
  assert.deepEqual(exerciseKinds({ exerciseType: "mobility", names: ["Hip Circles"] }), ["stretch"]);
});

test("RepDB-categorie stretching telt als stretch, ook bij een omgezet type", () => {
  assert.deepEqual(
    exerciseKinds({ exerciseType: "strength", libraryCategory: "stretching", names: ["Calf Stretch"] }),
    ["strength", "stretch"]
  );
});

test("yoga/pilates uit naam of synoniem, gecombineerd met de type-soort", () => {
  assert.deepEqual(
    exerciseKinds({ exerciseType: "mobility", libraryCategory: "stretching", names: ["camel-pose", "Camel Pose", "ustrasana"] }),
    ["stretch", "yoga"]
  );
  assert.deepEqual(
    exerciseKinds({ exerciseType: "isometric", names: ["Boat Pose", "navasana"] }),
    ["strength", "yoga"]
  );
  assert.deepEqual(
    exerciseKinds({ exerciseType: "core", names: ["Pilates Hundred"] }),
    ["core", "pilates"]
  );
});

test("onbekend type zonder discipline → geen soort (valt alleen onder Alles)", () => {
  assert.deepEqual(exerciseKinds({ exerciseType: "rehab", names: ["Band Walk"] }), []);
});

test("uitvoer volgt de vaste chip-volgorde", () => {
  const kinds = exerciseKinds({ exerciseType: "mobility", libraryCategory: "stretching", names: ["Pilates Roll Up", "roll up pose"] });
  const idx = kinds.map((k) => EXERCISE_KIND_ORDER.indexOf(k));
  assert.deepEqual(idx, [...idx].sort((a, b) => a - b));
});
