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
  sessionCapacity,
  enrollmentWindowOpen,
  decideEnroll,
  promotableCount,
  noShowCutoff,
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

test("wachtlijst: uitschrijven kan ook vanuit WAITLISTED, maar bezet geen plek", () => {
  assert.equal(canUnenroll("WAITLISTED"), true);
  assert.equal(countsTowardCapacity("WAITLISTED"), false);
  assert.equal(canReenroll("WAITLISTED"), false);
});

test("sessionCapacity: sessie-override wint van de les-default", () => {
  assert.equal(sessionCapacity({ maxParticipants: null, groupClass: { maxParticipants: 12 } }), 12);
  assert.equal(sessionCapacity({ maxParticipants: 6, groupClass: { maxParticipants: 12 } }), 6);
});

test("aanmeldvenster sluit op de starttijd", () => {
  const startsAt = new Date("2026-09-01T16:00:00Z");
  assert.equal(enrollmentWindowOpen({ startsAt }, new Date("2026-09-01T15:59:00Z")), true);
  assert.equal(enrollmentWindowOpen({ startsAt }, startsAt), false);
  assert.equal(enrollmentWindowOpen({ startsAt }, new Date("2026-09-01T16:05:00Z")), false);
});

test("decideEnroll: gesloten → closed; vol → wachtlijst; anders aangemeld; definitieve status blijft", () => {
  const base = { existingStatus: null, capacity: 2, activeCount: 1, windowOpen: true };
  assert.equal(decideEnroll(base), "enrolled");
  assert.equal(decideEnroll({ ...base, activeCount: 2 }), "waitlisted");
  assert.equal(decideEnroll({ ...base, windowOpen: false }), "closed");
  assert.equal(decideEnroll({ ...base, existingStatus: "ENROLLED" }), "unchanged");
  assert.equal(decideEnroll({ ...base, existingStatus: "WAITLISTED" }), "unchanged");
  assert.equal(decideEnroll({ ...base, existingStatus: "NO_SHOW" }), "unchanged");
  assert.equal(decideEnroll({ ...base, existingStatus: "CANCELLED" }), "enrolled");
  // Her-inschrijven op een volle les → weer wachtlijst.
  assert.equal(decideEnroll({ ...base, existingStatus: "CANCELLED", activeCount: 2 }), "waitlisted");
});

test("promotableCount: nooit negatief, begrensd op wachtlijst en vrije plekken", () => {
  assert.equal(promotableCount({ capacity: 10, activeCount: 8, waitlistCount: 5 }), 2);
  assert.equal(promotableCount({ capacity: 10, activeCount: 8, waitlistCount: 1 }), 1);
  assert.equal(promotableCount({ capacity: 10, activeCount: 10, waitlistCount: 3 }), 0);
  // Capaciteit verlaagd onder de bezetting: niemand schuift door, niemand wordt eruit gezet.
  assert.equal(promotableCount({ capacity: 5, activeCount: 8, waitlistCount: 3 }), 0);
});

test("noShowCutoff is de grens die de cron en isNoShowEligible delen", () => {
  const now = new Date("2026-07-02T08:00:00Z");
  assert.equal(noShowCutoff(now).toISOString(), "2026-07-01T20:00:00.000Z");
  assert.equal(isNoShowEligible({ status: "ENROLLED" }, { endsAt: noShowCutoff(now) }, now), true);
});
