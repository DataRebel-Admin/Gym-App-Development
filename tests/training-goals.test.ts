import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TRAINING_GOALS,
  hasGoalOverlap,
  parseTrainingGoals,
  preferredRequestGoal,
  sortByGoalMatch,
} from "../lib/training-goals";
import { SCHEMA_BLUEPRINTS } from "../lib/member-schema-blueprints";

/**
 * Personalisatie op sporterdoelen (/account/doelen): de match tussen
 * User.trainingGoals en templates/blueprints/aanvraag-prefill. Deze regels
 * worden gedeeld door de builder-startpagina en het aanvraagformulier en
 * moeten neutraal blijven zolang een lid géén doelen koos.
 */

test("parseTrainingGoals filtert onbekende keys en behoudt de volgorde", () => {
  assert.deepEqual(parseTrainingGoals(["muscle", "onzin", "strength"]), [
    "muscle",
    "strength",
  ]);
  assert.deepEqual(parseTrainingGoals(null), []);
  assert.deepEqual(parseTrainingGoals("muscle"), []);
});

test("hasGoalOverlap: match op minstens één doel, nooit op leeg/null", () => {
  assert.ok(hasGoalOverlap(["muscle"], ["strength", "muscle"]));
  assert.ok(!hasGoalOverlap(["mobility"], ["strength"]));
  assert.ok(!hasGoalOverlap([null, undefined], ["strength"]));
  // Zonder gekozen doelen matcht niets — personalisatie is opt-in.
  assert.ok(!hasGoalOverlap(["strength"], []));
});

test("sortByGoalMatch: passend eerst, stabiel binnen beide groepen", () => {
  const rows = [
    { id: "a", goal: "mobility" },
    { id: "b", goal: "muscle" },
    { id: "c", goal: null },
    { id: "d", goal: "muscle" },
  ];
  const sorted = sortByGoalMatch(rows, ["muscle"], (r) => [r.goal]);
  assert.deepEqual(
    sorted.map((r) => r.id),
    ["b", "d", "a", "c"]
  );
});

test("sortByGoalMatch: zonder doelen verandert de volgorde niet", () => {
  const rows = [{ goal: "muscle" }, { goal: "mobility" }];
  assert.deepEqual(sortByGoalMatch(rows, [], (r) => [r.goal]), rows);
});

test("preferredRequestGoal: eerste doel mét tegenhanger wint", () => {
  // mobility heeft bewust geen tegenhanger → het volgende doel wint.
  assert.equal(preferredRequestGoal(["mobility", "fat_loss"]), "WEIGHT_LOSS");
  assert.equal(preferredRequestGoal(["strength"]), "STRENGTH");
  assert.equal(preferredRequestGoal(["muscle"]), "MUSCLE");
  assert.equal(preferredRequestGoal(["conditioning"]), "CONDITION");
  assert.equal(preferredRequestGoal(["rehab"]), "REHAB");
  // Geen mapbaar doel → geen prefill (nooit "OTHER" gokken).
  assert.equal(preferredRequestGoal(["mobility", "stability", "health", "sport"]), null);
  assert.equal(preferredRequestGoal([]), null);
});

test("blueprint-doelen bestaan in de registry; 'leeg starten' matcht nooit", () => {
  for (const bp of SCHEMA_BLUEPRINTS) {
    for (const goal of bp.goals) {
      assert.ok(goal in TRAINING_GOALS, `${bp.key}: onbekend doel "${goal}"`);
    }
  }
  const scratch = SCHEMA_BLUEPRINTS.find((b) => b.key === "scratch");
  assert.deepEqual(scratch?.goals, []);
});

test("elk sporterdoel sorteert minstens één blueprint naar boven", () => {
  // Anders belooft de UI personalisatie die voor dat doel niets doet. Doelen
  // zonder passend blueprint zijn toegestaan zodra dat een bewuste keuze is —
  // dan hoort deze test aangepast, niet verwijderd.
  for (const key of Object.keys(TRAINING_GOALS)) {
    const matched = SCHEMA_BLUEPRINTS.some((bp) => hasGoalOverlap(bp.goals, [key]));
    assert.ok(matched, `doel "${key}" heeft geen enkel passend blueprint`);
  }
});
