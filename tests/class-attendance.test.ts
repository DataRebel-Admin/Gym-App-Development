// Pure-logica-tests voor de aanwezigheids-/no-show-levenscyclus van
// les-aanmeldingen (lib/class-attendance.ts). Geen testframework-dependency:
// Node's `node:test` via tsx. Draaien: `npx tsx --test tests/class-attendance.test.ts`
// (of `npm test`).
//
// De DB-afhankelijke delen (enroll/unenroll-transactie, cron) zijn server-only;
// hier testen we de capaciteits- en overgangsregels die de server autoritatief
// toepast — bewust puur gehouden.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ACTIVE_ENROLLMENT_STATUSES,
  countsTowardCapacity,
  canUnenroll,
  canReenroll,
  isNoShowEligible,
  NO_SHOW_GRACE_HOURS,
  type EnrollmentStatusValue,
} from "../lib/class-attendance";

const HOUR = 3_600_000;

test("capaciteit telt alleen ENROLLED en ATTENDED — CANCELLED en NO_SHOW bezetten geen plek", () => {
  const statuses: EnrollmentStatusValue[] = ["ENROLLED", "ATTENDED", "CANCELLED", "NO_SHOW"];
  const counted = statuses.filter(countsTowardCapacity);
  assert.deepEqual(counted, [...ACTIVE_ENROLLMENT_STATUSES]);
  assert.equal(countsTowardCapacity("CANCELLED"), false);
  assert.equal(countsTowardCapacity("NO_SHOW"), false);
});

test("uitschrijven kan alleen vanuit ENROLLED; her-inschrijven alleen vanuit CANCELLED", () => {
  assert.equal(canUnenroll("ENROLLED"), true);
  assert.equal(canUnenroll("ATTENDED"), false);
  assert.equal(canUnenroll("NO_SHOW"), false);
  assert.equal(canUnenroll("CANCELLED"), false);

  assert.equal(canReenroll("CANCELLED"), true);
  assert.equal(canReenroll("ENROLLED"), false);
  assert.equal(canReenroll("ATTENDED"), false);
  assert.equal(canReenroll("NO_SHOW"), false);
});

test("no-show-markering respecteert de respijtperiode na endsAt", () => {
  const endsAt = new Date("2026-07-01T20:00:00Z");
  const session = { endsAt };
  const enrolled = { status: "ENROLLED" as const };

  // Nét afgelopen → nog niet rijp (staff kan aanwezigheid nog markeren).
  assert.equal(isNoShowEligible(enrolled, session, new Date(endsAt.getTime() + HOUR)), false);
  // Precies op de grens → rijp.
  assert.equal(
    isNoShowEligible(enrolled, session, new Date(endsAt.getTime() + NO_SHOW_GRACE_HOURS * HOUR)),
    true
  );
  // Ruim erna → rijp.
  assert.equal(isNoShowEligible(enrolled, session, new Date(endsAt.getTime() + 48 * HOUR)), true);
});

test("alleen ENROLLED-rijen worden ooit no-show — afgemeld/aanwezig blijft staan", () => {
  const session = { endsAt: new Date("2026-07-01T20:00:00Z") };
  const veelLater = new Date("2026-07-10T20:00:00Z");
  for (const status of ["CANCELLED", "ATTENDED", "NO_SHOW"] as const) {
    assert.equal(isNoShowEligible({ status }, session, veelLater), false);
  }
});
