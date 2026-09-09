// Pure-logica-tests voor de toestel-agendasync (lib/calendar-device.ts).
// Draaien: `npx tsx --test tests/calendar-device.test.ts` (of `npm test`).
import { test } from "node:test";
import assert from "node:assert/strict";
import type { IcsEvent } from "../lib/calendar-ics";
import {
  DEVICE_SYNC_MIN_INTERVAL_MS,
  allDayUtcMs,
  icsEventsToDeviceEvents,
  shouldAutoSync,
} from "../lib/calendar-device";

test("allDayUtcMs geeft UTC-middernacht van de kalenderdag", () => {
  assert.equal(allDayUtcMs("2026-09-10"), Date.UTC(2026, 8, 10));
  assert.equal(new Date(allDayUtcMs("2026-01-01")).toISOString(), "2026-01-01T00:00:00.000Z");
});

test("hele-dag-event → ALL_DAY met exclusieve einddag", () => {
  const [ev] = icsEventsToDeviceEvents([
    { kind: "allday", uid: "plan-a-2026-09-10", dayKey: "2026-09-10", summary: "Training: Push · Gym" },
  ]);
  assert.equal(ev.allDay, true);
  assert.equal(ev.startMs, Date.UTC(2026, 8, 10));
  assert.equal(ev.endMs, Date.UTC(2026, 8, 11));
  assert.equal(ev.uid, "plan-a-2026-09-10");
  assert.equal(ev.tentative, false);
});

test("getimed event draagt epoch-ms, locatie en wachtlijst als tentative", () => {
  const start = new Date("2026-09-12T16:00:00Z");
  const end = new Date("2026-09-12T17:00:00Z");
  const [ev] = icsEventsToDeviceEvents([
    {
      kind: "timed",
      uid: "class-1",
      startUtc: start,
      endUtc: end,
      summary: "Spinning · Gym",
      location: "Centrum · Zaal 2",
      status: "TENTATIVE",
    },
  ]);
  assert.equal(ev.allDay, false);
  assert.equal(ev.startMs, start.getTime());
  assert.equal(ev.endMs, end.getTime());
  assert.equal(ev.location, "Centrum · Zaal 2");
  assert.equal(ev.tentative, true);
});

test("geannuleerde events gaan niet mee (de plugin ruimt ze dan op)", () => {
  const events: IcsEvent[] = [
    {
      kind: "timed",
      uid: "class-cancelled",
      startUtc: new Date("2026-09-12T16:00:00Z"),
      endUtc: new Date("2026-09-12T17:00:00Z"),
      summary: "Geschrapt",
      status: "CANCELLED",
    },
    { kind: "allday", uid: "plan-b", dayKey: "2026-09-13", summary: "Blijft" },
  ];
  const out = icsEventsToDeviceEvents(events);
  assert.deepEqual(
    out.map((e) => e.uid),
    ["plan-b"]
  );
});

test("shouldAutoSync: nooit gesynct → ja, daarna pas na het interval", () => {
  const now = Date.UTC(2026, 8, 9, 12);
  assert.equal(shouldAutoSync(null, now), true);
  assert.equal(shouldAutoSync(now - 1000, now), false);
  assert.equal(shouldAutoSync(now - DEVICE_SYNC_MIN_INTERVAL_MS, now), true);
});
