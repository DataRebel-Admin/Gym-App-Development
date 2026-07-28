// Pure logica voor de geleide (ronde-voor-ronde) groep-flow in de actieve
// training: een superset/giant set/circuit loopt A1 → B1 → rust → A2 → B2 → …;
// AMRAP is open-ended binnen een tijdslimiet. De positie is volledig AFGELEID
// uit de opgeslagen sets (geen aparte cursor-state) zodat een reload of het
// wisselen tussen geleide- en lijstweergave nooit uit de pas loopt.
//
// Bewust GEEN `server-only`: gebruikt door de client-UI van de actieve sessie
// en getest met node:test — idioom lib/exercise-groups.ts.

import {
  clampRounds,
  DEFAULT_GROUP_ROUNDS,
  type ItemGroup,
} from "@/lib/exercise-groups";

/** Harde bovengrens: de log-laag (`setInputSchema`) accepteert setNumber ≤ 20. */
export const MAX_GUIDED_ROUNDS = 20;

/** Open-ended groepen (AMRAP) hebben geen vast rondetal maar een tijdslimiet. */
export function isOpenEnded(group: Pick<ItemGroup, "type">): boolean {
  return group.type?.hasTimeCap ?? false;
}

/**
 * Effectief aantal rondes voor een geleide groep: expliciete groep-rondes
 * winnen, anders het grootste set-aantal van de (actieve) leden, anders de
 * default. Altijd 1..MAX_GUIDED_ROUNDS — één ronde = één setnummer, en de
 * log-laag accepteert geen hogere setnummers.
 */
export function effectiveGuidedRounds(
  group: Pick<ItemGroup, "rounds">,
  memberSetCounts: number[]
): number {
  const explicit = clampRounds(group.rounds);
  const fromSets = memberSetCounts.length > 0 ? Math.max(...memberSetCounts) : 0;
  const base = explicit ?? (fromSets > 0 ? fromSets : DEFAULT_GROUP_ROUNDS);
  return Math.min(MAX_GUIDED_ROUNDS, Math.max(1, base));
}

export type GuidedPosition =
  | { kind: "step"; round: number; memberIndex: number }
  | { kind: "done" };

/**
 * Leid de huidige stap af: de eerste (ronde, oefening) die nog niet klaar is,
 * in schema-volgorde. `isDone(memberIndex, round)` leest de opgeslagen staat
 * (ronde is 1-based). Geen enkele open stap meer → "done".
 */
export function deriveGuidedPosition(opts: {
  memberCount: number;
  rounds: number;
  isDone: (memberIndex: number, round: number) => boolean;
}): GuidedPosition {
  const { memberCount, isDone } = opts;
  const rounds = Math.min(MAX_GUIDED_ROUNDS, Math.max(0, Math.floor(opts.rounds)));
  if (memberCount <= 0) return { kind: "done" };
  for (let round = 1; round <= rounds; round++) {
    for (let m = 0; m < memberCount; m++) {
      if (!isDone(m, round)) return { kind: "step", round, memberIndex: m };
    }
  }
  return { kind: "done" };
}

/** Is ronde `round` (1-based) voor alle leden afgerond? */
export function isRoundComplete(
  round: number,
  memberCount: number,
  isDone: (memberIndex: number, round: number) => boolean
): boolean {
  for (let m = 0; m < memberCount; m++) {
    if (!isDone(m, round)) return false;
  }
  return true;
}

/** Aantal volledig afgeronde rondes (voor de AMRAP-teller). */
export function completedRoundCount(
  rounds: number,
  memberCount: number,
  isDone: (memberIndex: number, round: number) => boolean
): number {
  if (memberCount <= 0) return 0;
  let done = 0;
  for (let round = 1; round <= rounds; round++) {
    if (isRoundComplete(round, memberCount, isDone)) done += 1;
  }
  return done;
}
