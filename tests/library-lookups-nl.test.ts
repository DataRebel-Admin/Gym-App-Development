import test from "node:test";
import assert from "node:assert/strict";

import {
  MUSCLE_NL,
  EQUIPMENT_NL,
  withDutchName,
  hasDutchName,
} from "../lib/translate/library-lookups-nl";
import { resolveRegion } from "../lib/muscle-map";

test("elke Nederlandse spiernaam is herleidbaar naar een spierregio", () => {
  // Harde eis: de nl-naam belandt als vrij label in `Exercise.targetMuscle` bij
  // het toevoegen aan een sportschool. Een label dat `resolveRegion` niet kent,
  // kleurt stil géén spier meer op de heatmap — precies de klasse fout waar de
  // BRON-BEWUST-waarschuwing in CLAUDE.md over gaat.
  const unresolved = Object.entries(MUSCLE_NL).filter(
    ([, nl]) => resolveRegion(nl) === null
  );
  assert.deepEqual(unresolved, [], "niet-herleidbare spiernamen");
});

test("de slug zelf blijft ook herleidbaar (bron-bewuste telling)", () => {
  const unresolved = Object.keys(MUSCLE_NL).filter(
    (slug) => resolveRegion(slug) === null
  );
  assert.deepEqual(unresolved, [], "niet-herleidbare spier-slugs");
});

test("geen lege of niet-getrimde namen, sleutels zijn slugs", () => {
  for (const [map, label] of [
    [MUSCLE_NL, "spier"],
    [EQUIPMENT_NL, "materiaal"],
  ] as const) {
    for (const [slug, nl] of Object.entries(map)) {
      assert.match(slug, /^[a-z0-9_]+$/, `${label}-slug ${slug}`);
      assert.equal(nl, nl.trim(), `${label} ${slug} niet getrimd`);
      assert.ok(nl.length > 1, `${label} ${slug} leeg`);
      assert.equal(nl[0], nl[0].toUpperCase(), `${label} ${slug} zonder hoofdletter`);
    }
  }
});

test("naamsbeleid materiaal: gangbare leenwoorden blijven staan", () => {
  // In een Nederlandse sportschool heet dit ding een dumbbell, geen domoor.
  assert.equal(EQUIPMENT_NL.dumbbell, "Dumbbell");
  assert.equal(EQUIPMENT_NL.barbell, "Barbell");
  assert.equal(EQUIPMENT_NL.kettlebell, "Kettlebell");
  assert.equal(EQUIPMENT_NL.smith_machine, "Smith machine");
});

test("naamsbeleid materiaal: échte Nederlandse termen worden gebruikt", () => {
  assert.equal(EQUIPMENT_NL.treadmill, "Loopband");
  assert.equal(EQUIPMENT_NL.elliptical, "Crosstrainer");
  assert.equal(EQUIPMENT_NL.stationary_bike, "Hometrainer");
  assert.equal(EQUIPMENT_NL.leg_press, "Beenpers"); // zoals de seed/machinelijst
  assert.equal(EQUIPMENT_NL.cable, "Kabelmachine");
});

test("withDutchName voegt nl toe zonder de andere talen te raken", () => {
  const merged = withDutchName({ en: "Chest", de: "Brust" }, "Borst");
  assert.deepEqual(merged, { en: "Chest", de: "Brust", nl: "Borst" });
});

test("withDutchName overleeft onbruikbare invoer", () => {
  assert.deepEqual(withDutchName(null, "Borst"), { nl: "Borst" });
  assert.deepEqual(withDutchName("raar", "Borst"), { nl: "Borst" });
  assert.deepEqual(withDutchName(["a"], "Borst"), { nl: "Borst" });
});

test("hasDutchName maakt het script idempotent", () => {
  assert.equal(hasDutchName({ en: "Chest", nl: "Borst" }, "Borst"), true);
  assert.equal(hasDutchName({ en: "Chest", nl: "Bors" }, "Borst"), false);
  assert.equal(hasDutchName({ en: "Chest" }, "Borst"), false);
  assert.equal(hasDutchName(null, "Borst"), false);
});
