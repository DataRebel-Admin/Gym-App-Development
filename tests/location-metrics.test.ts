// Pure-logica-tests voor de gedeelde telregels (lib/metrics/definitions.ts):
// actieve leden (niet-optelbaar!), bezoeken (wél optelbaar), tijdzone-bewuste
// uur-bucketing, retentie en no-shows. Geen testframework-dependency: Node's
// `node:test` via tsx. Draaien: `npx tsx --test tests/location-metrics.test.ts`
// (of `npm test`). Dit dekt spec-scenario (a).

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  activeMemberCounts,
  visitsPerLocation,
  hourPartsInTz,
  monthKeyInTz,
  occupancyByHour,
  retentionRate,
  noShowStatsPerLocation,
  type VisitRow,
} from "../lib/metrics/definitions";

const CENTRUM = "loc-centrum";
const ZUID = "loc-zuid";

function visit(userId: string, locationId: string, iso: string): VisitRow {
  return { userId, locationId, at: new Date(iso) };
}

test("spec (a): lid actief op 2 vestigingen van één keten → org telt 1, beide vestigingen tellen 1, roll-up meldt geen 2", () => {
  const visits: VisitRow[] = [
    visit("duco", CENTRUM, "2026-07-01T10:00:00Z"),
    visit("duco", ZUID, "2026-07-03T18:00:00Z"),
  ];
  const counts = activeMemberCounts(visits);

  assert.equal(counts.org, 1); // de organisatie telt het lidmaatschap één keer
  assert.equal(counts.perLocation.get(CENTRUM), 1); // actief op Centrum → telt daar
  assert.equal(counts.perLocation.get(ZUID), 1); // actief op Zuid → telt daar ook
  // De vestigingstotalen tellen bewust NIET op tot het org-totaal…
  const sum = [...counts.perLocation.values()].reduce((a, b) => a + b, 0);
  assert.equal(sum, 2);
  assert.notEqual(counts.org, sum);
  // …en de roll-up (org) rapporteert dus géén 2.
  assert.equal(counts.org, 1);
});

test("bezoeken zijn per vestiging wél zuiver optelbaar", () => {
  const visits: VisitRow[] = [
    visit("duco", CENTRUM, "2026-07-01T10:00:00Z"),
    visit("duco", ZUID, "2026-07-03T18:00:00Z"),
    visit("lisa", ZUID, "2026-07-03T19:00:00Z"),
  ];
  const perLocation = visitsPerLocation(visits);
  assert.equal(perLocation.get(CENTRUM), 1);
  assert.equal(perLocation.get(ZUID), 2);
  const sum = [...perLocation.values()].reduce((a, b) => a + b, 0);
  assert.equal(sum, visits.length); // som van de vestigingen = org-totaal
});

test("uur-bucketing volgt de tijdzone van de vestiging, niet de servertijd", () => {
  // 23:30 UTC op zondag = 01:30 maandag in Amsterdam (zomertijd, UTC+2).
  const d = new Date("2026-07-05T23:30:00Z");
  assert.deepEqual(hourPartsInTz(d, "UTC"), { weekday: 6, hour: 23 }); // zondag 23u
  assert.deepEqual(hourPartsInTz(d, "Europe/Amsterdam"), { weekday: 0, hour: 1 }); // maandag 01u

  // Maandgrens: 31 juli 23:30 UTC is in Amsterdam al 1 augustus.
  const eom = new Date("2026-07-31T23:30:00Z");
  assert.equal(monthKeyInTz(eom, "UTC"), "2026-07");
  assert.equal(monthKeyInTz(eom, "Europe/Amsterdam"), "2026-08");

  // Bezetting gebruikt per vestiging de eigen tijdzone.
  const cells = occupancyByHour(
    [visit("duco", CENTRUM, "2026-07-05T23:30:00Z"), visit("lisa", ZUID, "2026-07-05T23:30:00Z")],
    new Map([
      [CENTRUM, "Europe/Amsterdam"],
      [ZUID, "UTC"],
    ])
  );
  const centrum = cells.find((c) => c.locationId === CENTRUM);
  const zuid = cells.find((c) => c.locationId === ZUID);
  assert.deepEqual({ weekday: centrum?.weekday, hour: centrum?.hour }, { weekday: 0, hour: 1 });
  assert.deepEqual({ weekday: zuid?.weekday, hour: zuid?.hour }, { weekday: 6, hour: 23 });
});

test("retentie = aandeel van maand M dat in M+1 terugkeert; lege maand → null", () => {
  assert.equal(retentionRate(["duco", "lisa"], ["duco", "tom"]), 0.5);
  assert.equal(retentionRate(["duco", "lisa"], []), 0);
  assert.equal(retentionRate([], ["duco"]), null);
  // Dubbele bezoeken van hetzelfde lid tellen niet dubbel (set-semantiek).
  assert.equal(retentionRate(["duco", "duco", "lisa"], ["duco"]), 0.5);
});

test("no-show-cijfers per vestiging: rate = noShow / (attended + noShow), afmeldingen tellen niet mee", () => {
  const stats = noShowStatsPerLocation([
    { locationId: CENTRUM, status: "ATTENDED" },
    { locationId: CENTRUM, status: "ATTENDED" },
    { locationId: CENTRUM, status: "ATTENDED" },
    { locationId: CENTRUM, status: "NO_SHOW" },
    { locationId: CENTRUM, status: "CANCELLED" },
    { locationId: ZUID, status: "ENROLLED" }, // nog niet afgehandeld → telt nergens in
  ]);
  const centrum = stats.get(CENTRUM);
  assert.equal(centrum?.attended, 3);
  assert.equal(centrum?.noShow, 1);
  assert.equal(centrum?.cancelled, 1);
  assert.equal(centrum?.rate, 0.25);
  // Vestiging zonder afgehandelde deelnames → geen rate (geen noemer).
  assert.equal(stats.get(ZUID)?.rate, null);
});
