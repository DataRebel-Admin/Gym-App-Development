// Pure-logica-tests voor de groeperings-helpers (superset/giant/circuit/AMRAP +
// dropset). Geen testframework-dependency: Node's ingebouwde `node:test` via tsx.
// Draaien: `npx tsx --test tests/exercise-groups.test.ts` (of `npm test`).

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  groupItems,
  isRealGroup,
  groupSummary,
  groupPositionLabel,
  clampRounds,
  clampDropsetCount,
  isDropset,
  isGroupType,
  getGroupType,
  type GroupableItem,
} from "../lib/exercise-groups";

function item(partial: Partial<GroupableItem>): GroupableItem {
  return {
    groupId: null,
    groupType: null,
    groupOrder: 0,
    groupRounds: null,
    groupRestSeconds: null,
    groupLabel: null,
    groupTimeCapSeconds: null,
    dropsetCount: null,
    ...partial,
  };
}

test("groupItems: losstaande items worden groepen van één zonder type", () => {
  const groups = groupItems([item({}), item({})]);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].type, null);
  assert.equal(isRealGroup(groups[0]), false);
});

test("groupItems: opeenvolgende items met dezelfde groupId + type vormen één groep", () => {
  const groups = groupItems([
    item({ groupId: "g1", groupType: "superset", groupOrder: 0 }),
    item({ groupId: "g1", groupType: "superset", groupOrder: 1 }),
    item({}),
  ]);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].items.length, 2);
  assert.equal(groups[0].type?.key, "superset");
  assert.equal(isRealGroup(groups[0]), true);
  assert.equal(groups[1].type, null);
});

test("groupItems: niet-aangrenzende items met hetzelfde groupId worden NIET verbonden", () => {
  const groups = groupItems([
    item({ groupId: "g1", groupType: "superset" }),
    item({}), // losstaand item onderbreekt
    item({ groupId: "g1", groupType: "superset" }),
  ]);
  assert.equal(groups.length, 3);
  assert.equal(groups[0].items.length, 1);
  assert.equal(groups[2].items.length, 1);
});

test("groupItems: onbekend groupType degradeert naar losstaand", () => {
  const groups = groupItems([item({ groupId: "g1", groupType: "onzin" })]);
  assert.equal(groups[0].type, null);
  assert.equal(groups[0].groupId, null);
});

test("groupSummary: rondes + rust voor circuit, timecap voor AMRAP", () => {
  const [circuit] = groupItems([
    item({ groupId: "c", groupType: "circuit", groupRounds: 4, groupRestSeconds: 90 }),
    item({ groupId: "c", groupType: "circuit" }),
  ]);
  assert.equal(groupSummary(circuit), "Circuit · 4 rondes · rust 1m 30s");

  const [amrap] = groupItems([
    item({ groupId: "a", groupType: "amrap", groupTimeCapSeconds: 720 }),
    item({ groupId: "a", groupType: "amrap" }),
  ]);
  assert.equal(groupSummary(amrap), "AMRAP · 12 min");

  assert.equal(groupSummary(groupItems([item({})])[0]), null);
});

test("groupSummary: eigen label wint van het type-label", () => {
  const [g] = groupItems([
    item({ groupId: "g", groupType: "superset", groupLabel: "Finisher", groupRounds: 3 }),
    item({ groupId: "g", groupType: "superset" }),
  ]);
  assert.equal(groupSummary(g), "Finisher · 3 rondes");
});

test("groupPositionLabel: A/B/C…", () => {
  assert.equal(groupPositionLabel(0), "A");
  assert.equal(groupPositionLabel(2), "C");
});

test("clampRounds klemt tussen 1 en 50", () => {
  assert.equal(clampRounds(0), 1);
  assert.equal(clampRounds(999), 50);
  assert.equal(clampRounds(3.7), 4);
  assert.equal(clampRounds(null), null);
});

test("clampDropsetCount: <1 → null, cap op 10", () => {
  assert.equal(clampDropsetCount(0), null);
  assert.equal(clampDropsetCount(-2), null);
  assert.equal(clampDropsetCount(3), 3);
  assert.equal(clampDropsetCount(99), 10);
});

test("isDropset leest de teller", () => {
  assert.equal(isDropset(item({ dropsetCount: 2 })), true);
  assert.equal(isDropset(item({ dropsetCount: null })), false);
});

test("type-guards", () => {
  assert.equal(isGroupType("superset"), true);
  assert.equal(isGroupType("nope"), false);
  assert.equal(getGroupType("amrap")?.label, "AMRAP");
  assert.equal(getGroupType(null), null);
});
