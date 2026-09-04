import { test } from "node:test";
import assert from "node:assert/strict";
import {
  zonedInputToDate,
  dateToZonedInput,
  addWeeksZoned,
  tzOffsetMs,
  wallClockDeltaMs,
  shiftWallClock,
} from "../lib/tz";

const AMS = "Europe/Amsterdam";

test("datetime-local in Amsterdam wordt de juiste absolute tijd (zomer- én wintertijd)", () => {
  assert.equal(zonedInputToDate("2026-07-01T18:00", AMS)?.toISOString(), "2026-07-01T16:00:00.000Z");
  assert.equal(zonedInputToDate("2026-01-15T18:00", AMS)?.toISOString(), "2026-01-15T17:00:00.000Z");
  assert.equal(zonedInputToDate("2026-07-01T18:00", "UTC")?.toISOString(), "2026-07-01T18:00:00.000Z");
});

test("round-trip via dateToZonedInput geeft dezelfde klok terug", () => {
  for (const input of ["2026-03-29T05:00", "2026-10-25T05:00", "2026-12-31T23:59"]) {
    const d = zonedInputToDate(input, AMS);
    assert.ok(d);
    assert.equal(dateToZonedInput(d, AMS), input);
  }
});

test("ongeldige invoer geeft null", () => {
  assert.equal(zonedInputToDate("", AMS), null);
  assert.equal(zonedInputToDate("morgen 18:00", AMS), null);
  assert.equal(zonedInputToDate("2026-13-01T18:00", AMS), null);
  assert.equal(zonedInputToDate("2026-02-30T18:00", AMS), null);
});

test("addWeeksZoned houdt de klok vast over de DST-overgang heen", () => {
  const start = zonedInputToDate("2026-03-24T18:00", AMS)!; // wintertijd
  const next = addWeeksZoned(start, 1, AMS); // 31 maart = zomertijd
  assert.equal(dateToZonedInput(next, AMS), "2026-03-31T18:00");
  assert.equal(next.getTime() - start.getTime(), 7 * 24 * 3600_000 - 3600_000);
});

test("wallClockDeltaMs meet op de klok, ook over een DST-overgang", () => {
  // 18:00 → 19:00 op dezelfde dag = 1 uur.
  const a = zonedInputToDate("2026-07-07T18:00", AMS)!;
  const b = zonedInputToDate("2026-07-07T19:00", AMS)!;
  assert.equal(wallClockDeltaMs(a, b, AMS), 3600_000);
  // di 24 mrt 18:00 (winter) → wo 1 apr 19:00 (zomer): op de klok
  // 8 dagen + 1 uur, ongeacht dat er absoluut een uur minder tussen zit.
  const c = zonedInputToDate("2026-03-24T18:00", AMS)!;
  const d = zonedInputToDate("2026-04-01T19:00", AMS)!;
  assert.equal(wallClockDeltaMs(c, d, AMS), 8 * 24 * 3600_000 + 3600_000);
});

test("shiftWallClock verschuift de klok DST-veilig (reeks-bewerking)", () => {
  // Reeks-scenario: de eerste sessie gaat van di 18:00 naar di 19:00
  // (delta = 1 uur op de klok); een sessie ná de DST-overgang schuift dan
  // óók naar 19:00 lokale tijd.
  const later = zonedInputToDate("2026-04-07T18:00", AMS)!; // zomertijd
  const shifted = shiftWallClock(later, 3600_000, AMS);
  assert.equal(dateToZonedInput(shifted, AMS), "2026-04-07T19:00");
  // Delta van een dag over de overgang heen blijft dezelfde klok.
  const winter = zonedInputToDate("2026-03-28T10:00", AMS)!;
  const overDst = shiftWallClock(winter, 2 * 24 * 3600_000, AMS); // 30 mrt = zomertijd
  assert.equal(dateToZonedInput(overDst, AMS), "2026-03-30T10:00");
});

test("tzOffsetMs: +2u in de zomer, +1u in de winter", () => {
  assert.equal(tzOffsetMs(new Date("2026-07-01T12:00:00Z"), AMS), 2 * 3600_000);
  assert.equal(tzOffsetMs(new Date("2026-01-01T12:00:00Z"), AMS), 3600_000);
});
