// Pure-logica-tests voor de sessie-scoped overrides (overslaan + vervangen).
// Geen testframework-dependency: Node's ingebouwde `node:test` via tsx.
// Draaien: `npx tsx --test tests/session-overrides.test.ts`.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseOverrides,
  toOverridesJson,
  withSkipped,
  withoutSkipped,
  withSub,
  withoutSub,
  withSetCount,
  MAX_SESSION_SETS,
} from "../lib/session-overrides";

const EMPTY = { skipped: [], subs: [], setCounts: {} };

test("parseOverrides normaliseert onzin naar leeg", () => {
  assert.deepEqual(parseOverrides(null), EMPTY);
  assert.deepEqual(parseOverrides(undefined), EMPTY);
  assert.deepEqual(parseOverrides([1, 2, 3]), EMPTY);
  assert.deepEqual(parseOverrides("x"), EMPTY);
});

test("parseOverrides filtert ongeldige entries eruit", () => {
  const parsed = parseOverrides({
    skipped: ["a", 1, "b", null],
    subs: [
      { from: "x", to: "y", name: "Alt" },
      { from: "x" }, // ongeldig (geen to)
      { to: "z" }, // ongeldig (geen from)
      { from: "p", to: "q" }, // name ontbreekt → ""
    ],
  });
  assert.deepEqual(parsed.skipped, ["a", "b"]);
  assert.deepEqual(parsed.subs, [
    { from: "x", to: "y", name: "Alt" },
    { from: "p", to: "q", name: "" },
  ]);
});

test("withSkipped is idempotent en dedupliceert", () => {
  let o = withSkipped(null, "a");
  o = withSkipped(toOverridesJson(o), "a");
  o = withSkipped(toOverridesJson(o), "b");
  assert.deepEqual(o.skipped, ["a", "b"]);
});

test("withoutSkipped verwijdert alleen de opgegeven id", () => {
  const start = toOverridesJson({ skipped: ["a", "b"], subs: [], setCounts: {} });
  assert.deepEqual(withoutSkipped(start, "a").skipped, ["b"]);
});

test("withSub houdt `from` uniek (vervangt eerdere sub)", () => {
  let o = withSub(null, { from: "a", to: "b", name: "B" });
  o = withSub(toOverridesJson(o), { from: "a", to: "c", name: "C" });
  assert.equal(o.subs.length, 1);
  assert.deepEqual(o.subs[0], { from: "a", to: "c", name: "C" });
});

test("skip heft een bestaande sub op hetzelfde item op", () => {
  const withASub = toOverridesJson(withSub(null, { from: "a", to: "b", name: "B" }));
  const afterSkip = withSkipped(withASub, "a");
  assert.deepEqual(afterSkip.skipped, ["a"]);
  assert.deepEqual(afterSkip.subs, []);
});

test("sub op een overgeslagen item heft de skip op", () => {
  const skippedA = toOverridesJson(withSkipped(null, "a"));
  const afterSub = withSub(skippedA, { from: "a", to: "b", name: "B" });
  assert.deepEqual(afterSub.skipped, []);
  assert.deepEqual(afterSub.subs, [{ from: "a", to: "b", name: "B" }]);
});

test("withoutSub zet alleen de opgegeven vervanging terug", () => {
  const start = toOverridesJson(
    withSub(toOverridesJson(withSub(null, { from: "a", to: "b", name: "B" })), {
      from: "c",
      to: "d",
      name: "D",
    })
  );
  const reverted = withoutSub(start, "a");
  assert.deepEqual(reverted.subs, [{ from: "c", to: "d", name: "D" }]);
});

test("withSetCount klemt op 1..MAX_SESSION_SETS en overschrijft per oefening", () => {
  let o = withSetCount(null, "ex1", 5);
  assert.deepEqual(o.setCounts, { ex1: 5 });
  o = withSetCount(toOverridesJson(o), "ex1", 4);
  o = withSetCount(toOverridesJson(o), "ex2", 999);
  o = withSetCount(toOverridesJson(o), "ex3", 0);
  assert.deepEqual(o.setCounts, { ex1: 4, ex2: MAX_SESSION_SETS, ex3: 1 });
});

test("setCounts overleven skippen/vervangen (staan los van de weergave)", () => {
  const withCount = toOverridesJson(withSetCount(null, "ex1", 4));
  const afterSkip = withSkipped(withCount, "ex1");
  assert.deepEqual(afterSkip.setCounts, { ex1: 4 });
  const afterSub = withSub(toOverridesJson(afterSkip), { from: "ex1", to: "ex9", name: "Alt" });
  assert.deepEqual(afterSub.setCounts, { ex1: 4 });
});

test("parseOverrides negeert onbruikbare setCounts", () => {
  const parsed = parseOverrides({ setCounts: { a: "3", b: "x", c: null, d: 2.7 } });
  assert.deepEqual(parsed.setCounts, { a: 3, d: 2 });
});
