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
} from "../lib/session-overrides";

test("parseOverrides normaliseert onzin naar leeg", () => {
  assert.deepEqual(parseOverrides(null), { skipped: [], subs: [] });
  assert.deepEqual(parseOverrides(undefined), { skipped: [], subs: [] });
  assert.deepEqual(parseOverrides([1, 2, 3]), { skipped: [], subs: [] });
  assert.deepEqual(parseOverrides("x"), { skipped: [], subs: [] });
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
  const start = toOverridesJson({ skipped: ["a", "b"], subs: [] });
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
