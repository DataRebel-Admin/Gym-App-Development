// Pure-logica-tests voor de tijdreeks-buckets (lib/metrics/definitions.ts):
// dag-/week-sleutels in de vestiging-tijdzone, de volledige bucket-as
// (incl. lege en partiële randbuckets), tellingen per bucket en de
// lesbezetting/no-show-trend. Geen testframework-dependency: Node's
// `node:test` via tsx. Draaien: `npx tsx --test tests/metrics-buckets.test.ts`
// (of `npm test`).

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  granularityForWindow,
  dayKeyInTz,
  weekStartKeyInTz,
  bucketKeyInTz,
  enumerateBucketKeys,
  countPerBucket,
  classTrendPerBucket,
  weekdayTotals,
  type ClassSessionStat,
  type OccupancyCell,
} from "../lib/metrics/definitions";

const CENTRUM = "loc-centrum";
const ZUID = "loc-zuid";

test("granularityForWindow: 7 dagen → per dag, 30/90 → per week", () => {
  assert.equal(granularityForWindow(7), "day");
  assert.equal(granularityForWindow(30), "week");
  assert.equal(granularityForWindow(90), "week");
});

test("dayKeyInTz volgt de tijdzone van de vestiging over de middernachtgrens", () => {
  // 23:30 UTC = 01:30 de vólgende dag in Amsterdam (zomertijd, UTC+2).
  const d = new Date("2026-07-05T23:30:00Z");
  assert.equal(dayKeyInTz(d, "UTC"), "2026-07-05");
  assert.equal(dayKeyInTz(d, "Europe/Amsterdam"), "2026-07-06");
});

test("weekStartKeyInTz: maandag is de weekstart (weekdag 0 = ma)", () => {
  // Zondag 5 juli 2026 → week van maandag 29 juni.
  assert.equal(weekStartKeyInTz(new Date("2026-07-05T12:00:00Z"), "UTC"), "2026-06-29");
  // Maandag 00:30 lokale tijd blijft in de éigen week (23:30 UTC zondag).
  assert.equal(weekStartKeyInTz(new Date("2026-07-05T23:30:00Z"), "Europe/Amsterdam"), "2026-07-06");
  // Maandag zelf → dezelfde dag.
  assert.equal(weekStartKeyInTz(new Date("2026-07-06T10:00:00Z"), "UTC"), "2026-07-06");
  // Jaargrens: vrijdag 1 januari 2027 hoort bij de week van maandag 28 december 2026.
  assert.equal(weekStartKeyInTz(new Date("2027-01-01T12:00:00Z"), "UTC"), "2026-12-28");
});

test("bucketKeyInTz kiest dag- of week-sleutel op korrel", () => {
  const d = new Date("2026-07-05T12:00:00Z");
  assert.equal(bucketKeyInTz(d, "UTC", "day"), "2026-07-05");
  assert.equal(bucketKeyInTz(d, "UTC", "week"), "2026-06-29");
});

test("enumerateBucketKeys (dag): precies windowDays sleutels t/m vandaag, gesorteerd", () => {
  const now = new Date("2026-07-29T10:00:00Z");
  const keys = enumerateBucketKeys(now, 7, "UTC", "day");
  assert.equal(keys.length, 7);
  assert.equal(keys[0], "2026-07-23");
  assert.equal(keys[6], "2026-07-29");
  assert.deepEqual([...keys].sort(), keys);
});

test("enumerateBucketKeys (week): alle weken die het venster raken, incl. partiële randbucket, zonder duplicaten", () => {
  const now = new Date("2026-07-29T10:00:00Z"); // woensdag
  const keys = enumerateBucketKeys(now, 30, "UTC", "week");
  // Venster [29 jun … 29 jul] raakt de weken van ma 29/6 t/m ma 27/7 → 5 weken.
  assert.deepEqual(keys, ["2026-06-29", "2026-07-06", "2026-07-13", "2026-07-20", "2026-07-27"]);
  assert.equal(new Set(keys).size, keys.length);
});

test("countPerBucket telt per vestiging in de eigen tijdzone", () => {
  const rows = [
    { locationId: CENTRUM, at: new Date("2026-07-05T23:30:00Z") }, // Amsterdam → 6 juli
    { locationId: CENTRUM, at: new Date("2026-07-06T08:00:00Z") },
    { locationId: ZUID, at: new Date("2026-07-05T23:30:00Z") }, // UTC → 5 juli
  ];
  const tz = new Map([
    [CENTRUM, "Europe/Amsterdam"],
    [ZUID, "UTC"],
  ]);
  const perDay = countPerBucket(rows, tz, "day");
  assert.equal(perDay.get(CENTRUM)?.get("2026-07-06"), 2);
  assert.equal(perDay.get(CENTRUM)?.get("2026-07-05"), undefined);
  assert.equal(perDay.get(ZUID)?.get("2026-07-05"), 1);
});

test("classTrendPerBucket: bezetting = Σenrolled/Σcapacity, no-show-rate over afgehandelde deelnames", () => {
  const week = "2026-07-06";
  const rows: ClassSessionStat[] = [
    { locationId: CENTRUM, startsAt: new Date("2026-07-06T18:00:00Z"), capacity: 10, enrolledActive: 8, attended: 7, noShow: 1 },
    { locationId: CENTRUM, startsAt: new Date("2026-07-08T18:00:00Z"), capacity: 10, enrolledActive: 4, attended: 3, noShow: 1 },
  ];
  const trend = classTrendPerBucket(rows, new Map([[CENTRUM, "UTC"]]), "week");
  const bucket = trend.get(week);
  assert.equal(bucket?.sessions, 2);
  assert.equal(bucket?.occupancyRate, 12 / 20);
  assert.equal(bucket?.noShowRate, 2 / 12);
});

test("classTrendPerBucket: capaciteit 0 → occupancyRate null; geen afgehandelde deelnames → noShowRate null", () => {
  const rows: ClassSessionStat[] = [
    { locationId: CENTRUM, startsAt: new Date("2026-07-06T18:00:00Z"), capacity: 0, enrolledActive: 0, attended: 0, noShow: 0 },
  ];
  const bucket = classTrendPerBucket(rows, new Map([[CENTRUM, "UTC"]]), "week").get("2026-07-06");
  assert.equal(bucket?.occupancyRate, null);
  assert.equal(bucket?.noShowRate, null);
});

test("weekdayTotals sommeert heatmap-cellen per weekdag (0 = ma)", () => {
  const cells: OccupancyCell[] = [
    { locationId: CENTRUM, weekday: 0, hour: 9, count: 3 },
    { locationId: CENTRUM, weekday: 0, hour: 18, count: 5 },
    { locationId: CENTRUM, weekday: 6, hour: 11, count: 2 },
  ];
  assert.deepEqual(weekdayTotals(cells), [8, 0, 0, 0, 0, 0, 2]);
});
