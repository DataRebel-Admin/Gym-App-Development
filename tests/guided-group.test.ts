import { test } from "node:test";
import assert from "node:assert/strict";

import {
  MAX_GUIDED_ROUNDS,
  effectiveGuidedRounds,
  deriveGuidedPosition,
  isRoundComplete,
  completedRoundCount,
} from "../lib/guided-group";

// Handige matrix-helper: done[m][r-1] = true betekent lid m heeft ronde r af.
function doneFrom(matrix: boolean[][]) {
  return (m: number, round: number) => Boolean(matrix[m]?.[round - 1]);
}

test("effectiveGuidedRounds: expliciete groep-rondes winnen van set-aantallen", () => {
  assert.equal(effectiveGuidedRounds({ rounds: 4 }, [3, 5]), 4);
});

test("effectiveGuidedRounds: zonder rondes wint het grootste set-aantal", () => {
  assert.equal(effectiveGuidedRounds({ rounds: null }, [3, 5]), 5);
});

test("effectiveGuidedRounds: zonder alles → default, en altijd ≤ MAX", () => {
  assert.equal(effectiveGuidedRounds({ rounds: null }, []), 3);
  assert.equal(effectiveGuidedRounds({ rounds: 50 }, []), MAX_GUIDED_ROUNDS);
  assert.equal(effectiveGuidedRounds({ rounds: 0 }, []), 1); // clampRounds klemt 0 → 1
});

test("deriveGuidedPosition: verse groep start bij ronde 1, oefening A", () => {
  const pos = deriveGuidedPosition({
    memberCount: 2,
    rounds: 3,
    isDone: doneFrom([[], []]),
  });
  assert.deepEqual(pos, { kind: "step", round: 1, memberIndex: 0 });
});

test("deriveGuidedPosition: na A1 volgt B1, daarna A2", () => {
  const afterA1 = deriveGuidedPosition({
    memberCount: 2,
    rounds: 3,
    isDone: doneFrom([[true], []]),
  });
  assert.deepEqual(afterA1, { kind: "step", round: 1, memberIndex: 1 });

  const afterB1 = deriveGuidedPosition({
    memberCount: 2,
    rounds: 3,
    isDone: doneFrom([[true], [true]]),
  });
  assert.deepEqual(afterB1, { kind: "step", round: 2, memberIndex: 0 });
});

test("deriveGuidedPosition: gaten worden eerst opgevuld (afgeleid, geen cursor)", () => {
  // B1 is gedaan maar A1 niet → de wizard wijst A1 aan.
  const pos = deriveGuidedPosition({
    memberCount: 2,
    rounds: 2,
    isDone: doneFrom([[], [true]]),
  });
  assert.deepEqual(pos, { kind: "step", round: 1, memberIndex: 0 });
});

test("deriveGuidedPosition: alles af → done; lege groep → done", () => {
  assert.deepEqual(
    deriveGuidedPosition({
      memberCount: 2,
      rounds: 2,
      isDone: () => true,
    }),
    { kind: "done" }
  );
  assert.deepEqual(
    deriveGuidedPosition({ memberCount: 0, rounds: 3, isDone: () => false }),
    { kind: "done" }
  );
});

test("isRoundComplete + completedRoundCount", () => {
  const isDone = doneFrom([
    [true, true, false],
    [true, false, false],
  ]);
  assert.equal(isRoundComplete(1, 2, isDone), true);
  assert.equal(isRoundComplete(2, 2, isDone), false);
  assert.equal(completedRoundCount(3, 2, isDone), 1);
  assert.equal(completedRoundCount(3, 0, isDone), 0);
});
