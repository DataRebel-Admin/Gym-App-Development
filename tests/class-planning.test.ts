// Pure-logica-tests voor het uitrollen van een weekpatroon naar sessies
// (lib/class-planning.ts). Draaien: `npx tsx --test tests/class-planning.test.ts`
// (of `npm test`).
//
// De kern van deze module is DST-veiligheid: een sportschool plant "dinsdag
// 19:00" en verwacht dat dat 19:00 blijft, ook nadat de klok verzet is.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  expandWeeklyPlan,
  normalizeWeekdays,
  plannedSessionCount,
  MAX_PLANNED_SESSIONS,
} from "../lib/class-planning";
import { dateToZonedInput, zonedInputToDate } from "../lib/tz";

const TZ = "Europe/Amsterdam";

/** Klok in de vestiging-tijdzone → absolute Date (zoals de server-action doet). */
function at(input: string): Date {
  const d = zonedInputToDate(input, TZ);
  assert.ok(d, `ongeldige testinvoer: ${input}`);
  return d;
}

/** Terug naar de klok, zodat een assert leesbaar is. */
function clock(d: Date): string {
  return dateToZonedInput(d, TZ);
}

test("zonder gekozen weekdagen blijft het de wekelijkse reeks van vroeger", () => {
  // Woensdag 2 september 2026, 19:00-20:00, drie weken.
  const plan = expandWeeklyPlan({
    startsAt: at("2026-09-02T19:00"),
    endsAt: at("2026-09-02T20:00"),
    weekdays: [],
    weeks: 3,
    timezone: TZ,
  });
  assert.equal(plan.length, 4);
  assert.deepEqual(
    plan.map((p) => clock(p.startsAt)),
    ["2026-09-02T19:00", "2026-09-09T19:00", "2026-09-16T19:00", "2026-09-23T19:00"]
  );
  // Duur blijft een uur.
  for (const p of plan) {
    assert.equal(p.endsAt.getTime() - p.startsAt.getTime(), 3_600_000);
  }
});

test("meerdere weekdagen: ma+wo+vr vanaf een woensdag slaat de maandag ervóór over", () => {
  const plan = expandWeeklyPlan({
    startsAt: at("2026-09-02T19:00"), // woensdag
    endsAt: at("2026-09-02T20:00"),
    weekdays: [1, 3, 5],
    weeks: 1,
    timezone: TZ,
  });
  // Ankerweek: alleen wo + vr (de maandag lag vóór het anker). Week erna: alle drie.
  assert.deepEqual(
    plan.map((p) => clock(p.startsAt)),
    [
      "2026-09-02T19:00",
      "2026-09-04T19:00",
      "2026-09-07T19:00",
      "2026-09-09T19:00",
      "2026-09-11T19:00",
    ]
  );
});

test("de klokstand overleeft de overgang naar wintertijd", () => {
  // Zondag 25 oktober 2026 gaat de klok terug. Een dinsdagreeks eromheen moet
  // op 19:00 lokale tijd blijven staan, niet naar 18:00 of 20:00 schuiven.
  const plan = expandWeeklyPlan({
    startsAt: at("2026-10-20T19:00"), // dinsdag vóór de overgang
    endsAt: at("2026-10-20T20:15"),
    weekdays: [2],
    weeks: 2,
    timezone: TZ,
  });
  assert.deepEqual(
    plan.map((p) => clock(p.startsAt)),
    ["2026-10-20T19:00", "2026-10-27T19:00", "2026-11-03T19:00"]
  );
  // Ook de eindtijd blijft op de klok staan (75 minuten later).
  assert.deepEqual(
    plan.map((p) => clock(p.endsAt)),
    ["2026-10-20T20:15", "2026-10-27T20:15", "2026-11-03T20:15"]
  );
});

test("uitkomst is gesorteerd en ontdubbeld", () => {
  const plan = expandWeeklyPlan({
    startsAt: at("2026-09-02T19:00"), // woensdag
    endsAt: at("2026-09-02T20:00"),
    // De ankerdag staat er dubbel in; dat mag geen dubbele sessie geven.
    weekdays: [3, 1, 3],
    weeks: 0,
    timezone: TZ,
  });
  assert.deepEqual(plan.map((p) => clock(p.startsAt)), ["2026-09-02T19:00"]);

  const times = expandWeeklyPlan({
    startsAt: at("2026-09-07T08:00"), // maandag
    endsAt: at("2026-09-07T09:00"),
    weekdays: [5, 1, 3],
    weeks: 0,
    timezone: TZ,
  }).map((p) => p.startsAt.getTime());
  assert.deepEqual([...times].sort((a, b) => a - b), times);
});

test("normalizeWeekdays gooit onzin weg en valt terug op de ankerdag", () => {
  assert.deepEqual(normalizeWeekdays([], 4), [4]);
  assert.deepEqual(normalizeWeekdays([9, 0, -1], 2), [2]);
  assert.deepEqual(normalizeWeekdays([5, 1, 5, 3], 2), [1, 3, 5]);
});

test("een absurd plan wordt afgekapt op MAX_PLANNED_SESSIONS", () => {
  const count = plannedSessionCount({
    startsAt: at("2026-01-05T06:00"),
    endsAt: at("2026-01-05T07:00"),
    weekdays: [1, 2, 3, 4, 5, 6, 7],
    weeks: 100,
    timezone: TZ,
  });
  assert.equal(count, MAX_PLANNED_SESSIONS);
});
