import { test } from "node:test";
import assert from "node:assert/strict";
import {
  suggestAlternatives,
  type SuggestibleExercise,
} from "../lib/exercise-suggestions";

function ex(
  id: string,
  over: Partial<SuggestibleExercise> = {}
): SuggestibleExercise {
  return {
    id,
    name: id,
    exerciseType: "strength",
    muscles: [],
    secondaryMuscles: [],
    bodyPart: null,
    equipment: null,
    ...over,
  };
}

test("zelfde primaire spiergroep wint van secundaire overlap", () => {
  const bench = ex("bench", { muscles: ["chest"], secondaryMuscles: ["triceps"] });
  const all = [
    bench,
    ex("db-press", { muscles: ["chest"], equipment: "dumbbell" }),
    ex("pushdown", { muscles: ["triceps"] }),
    ex("squat", { muscles: ["quads"] }),
  ];
  const out = suggestAlternatives(all, bench, []);
  assert.equal(out[0].exercise.id, "db-press");
  assert.equal(out[0].reason, "Zelfde spiergroep");
  // Triceps overlapt alleen secundair → wel voorgesteld, maar lager.
  assert.ok(out.some((s) => s.exercise.id === "pushdown"));
  // Quads deelt niets → geen suggestie.
  assert.ok(!out.some((s) => s.exercise.id === "squat"));
});

test("de oefening zelf en al toegevoegde oefeningen vallen weg", () => {
  const bench = ex("bench", { muscles: ["chest"] });
  const all = [bench, ex("db-press", { muscles: ["chest"] }), ex("dips", { muscles: ["chest"] })];
  const out = suggestAlternatives(all, bench, ["db-press"]);
  assert.deepEqual(
    out.map((s) => s.exercise.id),
    ["dips"]
  );
});

test("bron-overstijgend: RepDB-slug matcht Nederlands eigen-label", () => {
  // Bibliotheek-oefening draagt slugs ("chest"), een eigen oefening het
  // NL-label ("Borst") — resolveRegion normaliseert beide naar dezelfde regio.
  const libRow = ex("bench", { muscles: ["chest"] });
  const own = ex("eigen-borst", { muscles: ["Borst"] });
  const out = suggestAlternatives([libRow, own], libRow, []);
  assert.equal(out[0]?.exercise.id, "eigen-borst");
});

test("zonder zinnige match komt er niets", () => {
  const a = ex("a", { muscles: ["chest"] });
  const b = ex("b", { muscles: ["quads"], exerciseType: "cardio", bodyPart: "legs" });
  assert.deepEqual(suggestAlternatives([a, b], a, []), []);
});

test("take begrenst het aantal suggesties", () => {
  const src = ex("src", { muscles: ["chest"] });
  const all = [src, ...Array.from({ length: 8 }, (_, i) => ex(`c${i}`, { muscles: ["chest"] }))];
  assert.equal(suggestAlternatives(all, src, [], 3).length, 3);
});
