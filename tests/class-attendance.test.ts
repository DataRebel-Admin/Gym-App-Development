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
  canDeleteSession,
  canUnenroll,
  canReenroll,
  isNoShowEligible,
  NO_SHOW_GRACE_HOURS,
  sessionCapacity,
  enrollmentWindowOpen,
  decideEnroll,
  promotableCount,
  noShowCutoff,
  resolveBookingRules,
  enrollWindowState,
  cancelWindowOpen,
  countNoShows,
  noShowBlocked,
  waitlistPromotionOpen,
  attendanceOpen,
  MIN_REMIND_HOURS,
  MAX_REMIND_HOURS,
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

const OPEN_RULES = { maxBookingsPerWeek: null, noShowLimit: null };
const enrollBase = {
  existingStatus: null as EnrollmentStatusValue | null,
  capacity: 2,
  activeCount: 1,
  window: "open" as const,
  weekBookings: 0,
  noShowStrikes: 0,
  rules: OPEN_RULES,
};

test("decideEnroll: gesloten → closed; vol → wachtlijst; anders aangemeld; definitieve status blijft", () => {
  const base = enrollBase;
  assert.equal(decideEnroll(base), "enrolled");
  assert.equal(decideEnroll({ ...base, activeCount: 2 }), "waitlisted");
  assert.equal(decideEnroll({ ...base, window: "closed" }), "closed");
  assert.equal(decideEnroll({ ...base, existingStatus: "ENROLLED" }), "unchanged");
  assert.equal(decideEnroll({ ...base, existingStatus: "WAITLISTED" }), "unchanged");
  assert.equal(decideEnroll({ ...base, existingStatus: "NO_SHOW" }), "unchanged");
  assert.equal(decideEnroll({ ...base, existingStatus: "CANCELLED" }), "enrolled");
  // Her-inschrijven op een volle les → weer wachtlijst.
  assert.equal(decideEnroll({ ...base, existingStatus: "CANCELLED", activeCount: 2 }), "waitlisted");
});

test("decideEnroll: beleidsredenen gaan vóór wachtlijst, en de volgorde is verklarend", () => {
  const base = enrollBase;
  // Buiten de boekingshorizon: nog niet te boeken, geen wachtlijst.
  assert.equal(decideEnroll({ ...base, window: "tooEarly", activeCount: 9 }), "tooEarly");
  // Weeklimiet bereikt → limiet, niet "vol".
  assert.equal(
    decideEnroll({
      ...base,
      activeCount: 9,
      weekBookings: 3,
      rules: { ...OPEN_RULES, maxBookingsPerWeek: 3 },
    }),
    "weekLimit"
  );
  // No-show-blokkade wint van de weeklimiet (meest verklarende reden eerst).
  assert.equal(
    decideEnroll({
      ...base,
      weekBookings: 5,
      noShowStrikes: 3,
      rules: { maxBookingsPerWeek: 3, noShowLimit: 3 },
    }),
    "noShowBlock"
  );
  // Onder de limieten blijft alles gewoon werken.
  assert.equal(
    decideEnroll({
      ...base,
      weekBookings: 2,
      noShowStrikes: 2,
      rules: { maxBookingsPerWeek: 3, noShowLimit: 3 },
    }),
    "enrolled"
  );
  // Al aangemeld gaat vóór het beleid: geen verwarrende "geblokkeerd" op een
  // aanmelding die gewoon al staat.
  assert.equal(
    decideEnroll({ ...base, existingStatus: "ENROLLED", noShowStrikes: 9, rules: { maxBookingsPerWeek: 1, noShowLimit: 1 } }),
    "unchanged"
  );
});

test("promotableCount: nooit negatief, begrensd op wachtlijst en vrije plekken", () => {
  assert.equal(promotableCount({ capacity: 10, activeCount: 8, waitlistCount: 5 }), 2);
  assert.equal(promotableCount({ capacity: 10, activeCount: 8, waitlistCount: 1 }), 1);
  assert.equal(promotableCount({ capacity: 10, activeCount: 10, waitlistCount: 3 }), 0);
  // Capaciteit verlaagd onder de bezetting: niemand schuift door, niemand wordt eruit gezet.
  assert.equal(promotableCount({ capacity: 5, activeCount: 8, waitlistCount: 3 }), 0);
});

test("canDeleteSession: toekomstig altijd; gestart/afgelopen alleen zonder aanmeldingen", () => {
  const now = new Date("2026-09-01T18:30:00Z");
  const future = { startsAt: new Date("2026-09-01T19:00:00Z") };
  const running = { startsAt: new Date("2026-09-01T18:00:00Z") };

  // Nog niet gestart: verwijderbaar, ook mét aanmeldingen (die krijgen een melding).
  assert.equal(canDeleteSession(future, 5, now), true);
  // Gestart (of afgelopen) mét niet-afgemelde rijen: historie beschermen.
  assert.equal(canDeleteSession(running, 5, now), false);
  // Gestart zonder aanmeldingen: opruimen mag.
  assert.equal(canDeleteSession(running, 0, now), true);
  // Precies op de start = gestart (spiegelt enrollmentWindowOpen).
  assert.equal(canDeleteSession({ startsAt: now }, 1, now), false);
});

test("noShowCutoff is de grens die de cron en isNoShowEligible delen", () => {
  const now = new Date("2026-07-02T08:00:00Z");
  assert.equal(noShowCutoff(now).toISOString(), "2026-07-01T20:00:00.000Z");
  assert.equal(isNoShowEligible({ status: "ENROLLED" }, { endsAt: noShowCutoff(now) }, now), true);
});

// ── Boekingsregels ──────────────────────────────────────────────────────────

const TENANT_DEFAULTS = {
  classCancelDeadlineMinutes: 120,
  classBookingOpensDays: 14,
  classMaxBookingsPerWeek: 4,
  classNoShowLimit: 3,
  classRemindHoursBefore: 14,
};

test("resolveBookingRules: lestype-override wint, anders de sportschool-standaard", () => {
  assert.deepEqual(resolveBookingRules(null, TENANT_DEFAULTS), {
    cancelDeadlineMinutes: 120,
    bookingOpensDays: 14,
    maxBookingsPerWeek: 4,
    noShowLimit: 3,
    remindHoursBefore: 14,
  });
  const overridden = resolveBookingRules(
    {
      cancelDeadlineMinutes: 0,
      bookingOpensDays: 30,
      maxBookingsPerWeek: 1,
      remindHoursBefore: 2,
    },
    TENANT_DEFAULTS
  );
  assert.equal(overridden.cancelDeadlineMinutes, 0);
  assert.equal(overridden.bookingOpensDays, 30);
  assert.equal(overridden.maxBookingsPerWeek, 1);
  assert.equal(overridden.remindHoursBefore, 2);
  // Het no-show-beleid is sportschool-breed: geen override per lestype.
  assert.equal(overridden.noShowLimit, 3);
});

test("resolveBookingRules: een leeggemaakte limiet betekent 'uit', niet 'nul toegestaan'", () => {
  const rules = resolveBookingRules(
    { cancelDeadlineMinutes: null, bookingOpensDays: null, maxBookingsPerWeek: 0, remindHoursBefore: null },
    { ...TENANT_DEFAULTS, classMaxBookingsPerWeek: 0, classNoShowLimit: 0 }
  );
  assert.equal(rules.maxBookingsPerWeek, null);
  assert.equal(rules.noShowLimit, null);
  // En de herinnering blijft binnen de grenzen die de cron aankan.
  assert.equal(
    resolveBookingRules(null, { ...TENANT_DEFAULTS, classRemindHoursBefore: 999 }).remindHoursBefore,
    MAX_REMIND_HOURS
  );
  assert.equal(
    resolveBookingRules(null, { ...TENANT_DEFAULTS, classRemindHoursBefore: 0 }).remindHoursBefore,
    MIN_REMIND_HOURS
  );
});

test("enrollWindowState: te vroeg buiten de horizon, gesloten vanaf de start", () => {
  const now = new Date("2026-09-01T10:00:00Z");
  const rules = { bookingOpensDays: 14 };
  const inTenDays = { startsAt: new Date("2026-09-11T10:00:00Z") };
  const inTwentyDays = { startsAt: new Date("2026-09-21T10:00:00Z") };
  assert.equal(enrollWindowState(inTenDays, now, rules), "open");
  assert.equal(enrollWindowState(inTwentyDays, now, rules), "tooEarly");
  assert.equal(enrollWindowState({ startsAt: now }, now, rules), "closed");
});

test("cancelWindowOpen: afmelden stopt bij de deadline, niet pas bij de start", () => {
  const startsAt = new Date("2026-09-01T18:00:00Z");
  const rules = { cancelDeadlineMinutes: 120 };
  assert.equal(cancelWindowOpen({ startsAt }, new Date("2026-09-01T15:59:00Z"), rules), true);
  assert.equal(cancelWindowOpen({ startsAt }, new Date("2026-09-01T16:00:00Z"), rules), false);
  assert.equal(cancelWindowOpen({ startsAt }, new Date("2026-09-01T17:30:00Z"), rules), false);
  // Zonder deadline geldt de oude regel: tot de start.
  const none = { cancelDeadlineMinutes: 0 };
  assert.equal(cancelWindowOpen({ startsAt }, new Date("2026-09-01T17:59:00Z"), none), true);
  assert.equal(cancelWindowOpen({ startsAt }, startsAt, none), false);
});

test("no-show-teller kijkt terug over het venster; zonder limiet blokkeert niets", () => {
  const now = new Date("2026-09-30T12:00:00Z");
  const recent = [
    new Date("2026-09-29T18:00:00Z"),
    new Date("2026-09-10T18:00:00Z"),
    new Date("2026-08-01T18:00:00Z"), // buiten de 30 dagen
  ];
  assert.equal(countNoShows(recent, now), 2);
  assert.equal(noShowBlocked(2, 3), false);
  assert.equal(noShowBlocked(3, 3), true);
  assert.equal(noShowBlocked(99, null), false);
});

test("wachtlijst promoveert niet meer vlak vóór de start", () => {
  const startsAt = new Date("2026-09-01T18:00:00Z");
  assert.equal(waitlistPromotionOpen({ startsAt }, new Date("2026-09-01T16:00:00Z")), true);
  assert.equal(waitlistPromotionOpen({ startsAt }, new Date("2026-09-01T17:00:00Z")), false);
  assert.equal(waitlistPromotionOpen({ startsAt }, new Date("2026-09-01T17:45:00Z")), false);
});

test("aanwezigheid afvinken kan al vlak vóór de start", () => {
  const startsAt = new Date("2026-09-01T18:00:00Z");
  assert.equal(attendanceOpen({ startsAt }, new Date("2026-09-01T17:30:00Z")), false);
  assert.equal(attendanceOpen({ startsAt }, new Date("2026-09-01T17:45:00Z")), true);
  assert.equal(attendanceOpen({ startsAt }, new Date("2026-09-01T19:00:00Z")), true);
});
