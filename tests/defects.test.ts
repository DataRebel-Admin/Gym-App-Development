// Pure-logica-tests voor de defect-helpers (symptomenfilter, severity-bump,
// achterstand). Geen testframework-dependency: Node's ingebouwde `node:test`
// via tsx. Draaien: `npx tsx --test tests/defects.test.ts` (of `npm test`).

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFECT_SYMPTOMS,
  symptomsForMachineType,
  isDefectSymptomKey,
  defectSymptomLabel,
  bumpSeverity,
  CONFIRM_BUMP_THRESHOLD,
  isOpenDefectStatus,
  defectAgeDays,
  isOverdueDefect,
} from "../lib/defects";

// --- Symptomen -----------------------------------------------------------------

test("symptomsForMachineType: zonder type de volledige lijst", () => {
  assert.equal(symptomsForMachineType(null).length, DEFECT_SYMPTOMS.length);
  assert.equal(symptomsForMachineType(undefined).length, DEFECT_SYMPTOMS.length);
});

test("symptomsForMachineType: CARDIO heeft geen pin/bekleding, wel kabel en elektronica", () => {
  const keys = symptomsForMachineType("CARDIO").map((s) => s.key);
  assert.ok(!keys.includes("pin"));
  assert.ok(!keys.includes("upholstery"));
  assert.ok(keys.includes("cable"));
  assert.ok(keys.includes("electronics"));
  assert.ok(keys.includes("other")); // 'anders' altijd beschikbaar
});

test("symptomsForMachineType: KRACHT heeft pin, geen elektronica", () => {
  const keys = symptomsForMachineType("KRACHT").map((s) => s.key);
  assert.ok(keys.includes("pin"));
  assert.ok(!keys.includes("electronics"));
});

test("isDefectSymptomKey + label-fallback", () => {
  assert.ok(isDefectSymptomKey("noise"));
  assert.ok(!isDefectSymptomKey("kapot"));
  assert.equal(defectSymptomLabel("noise"), "Maakt raar geluid");
  assert.equal(defectSymptomLabel("onbekend"), "onbekend"); // key als fallback
});

// --- Severity-bump (acceptatiecriterium 4) --------------------------------------

test("bumpSeverity: MINOR → MAJOR", () => {
  assert.equal(bumpSeverity("MINOR"), "MAJOR");
});

test("bumpSeverity: MAJOR blijft MAJOR — nooit automatisch naar UNSAFE", () => {
  assert.equal(bumpSeverity("MAJOR"), "MAJOR");
});

test("bumpSeverity: UNSAFE blijft UNSAFE", () => {
  assert.equal(bumpSeverity("UNSAFE"), "UNSAFE");
});

test("CONFIRM_BUMP_THRESHOLD is 3 (spec)", () => {
  assert.equal(CONFIRM_BUMP_THRESHOLD, 3);
});

// --- Open-status & achterstand ---------------------------------------------------

test("isOpenDefectStatus: OPEN/ACKNOWLEDGED/IN_REPAIR open; RESOLVED/REJECTED niet", () => {
  assert.ok(isOpenDefectStatus("OPEN"));
  assert.ok(isOpenDefectStatus("ACKNOWLEDGED"));
  assert.ok(isOpenDefectStatus("IN_REPAIR"));
  assert.ok(!isOpenDefectStatus("RESOLVED"));
  assert.ok(!isOpenDefectStatus("REJECTED"));
});

test("defectAgeDays: hele dagen, nooit negatief", () => {
  const now = new Date("2026-07-30T12:00:00Z");
  assert.equal(defectAgeDays(new Date("2026-07-27T11:00:00Z"), now), 3);
  assert.equal(defectAgeDays(new Date("2026-07-30T09:00:00Z"), now), 0);
  assert.equal(defectAgeDays(new Date("2026-07-31T00:00:00Z"), now), 0); // toekomst → 0
});

test("isOverdueDefect: open + ouder dan termijn", () => {
  const now = new Date("2026-07-30T12:00:00Z");
  const oldOpen = { status: "OPEN" as const, createdAt: new Date("2026-07-20T12:00:00Z") };
  const freshOpen = { status: "OPEN" as const, createdAt: new Date("2026-07-28T12:00:00Z") };
  const oldResolved = {
    status: "RESOLVED" as const,
    createdAt: new Date("2026-07-01T12:00:00Z"),
  };
  assert.ok(isOverdueDefect(oldOpen, 7, now));
  assert.ok(!isOverdueDefect(freshOpen, 7, now));
  assert.ok(!isOverdueDefect(oldResolved, 7, now)); // afgerond telt nooit als achterstand
  // Termijn instelbaar per gym: met 2 dagen is de verse melding wél achterstand.
  assert.ok(isOverdueDefect(freshOpen, 2, now));
});
