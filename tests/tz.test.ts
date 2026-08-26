import { test } from "node:test";
import assert from "node:assert/strict";
import { zonedInputToDate, dateToZonedInput, addWeeksZoned, tzOffsetMs } from "../lib/tz";

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

test("tzOffsetMs: +2u in de zomer, +1u in de winter", () => {
  assert.equal(tzOffsetMs(new Date("2026-07-01T12:00:00Z"), AMS), 2 * 3600_000);
  assert.equal(tzOffsetMs(new Date("2026-01-01T12:00:00Z"), AMS), 3600_000);
});
