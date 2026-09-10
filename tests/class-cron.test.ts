// Bewaakt de koppeling tussen het cron-schema in vercel.json en de constante
// waar de herinnering-logica op rekent (REMINDER_CRON_INTERVAL_HOURS), plus de
// regel die voorkomt dat een dagelijkse cron lessen stilzwijgend overslaat.
//
// Idioom: tests/push-channels.test.ts bewaakt op dezelfde manier een koppeling
// die over meerdere bestanden loopt. Draaien: `npm test`.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { REMINDER_CRON_INTERVAL_HOURS, reminderDue } from "../lib/class-attendance";

/**
 * Interval (uren) uit een cron-expressie. Ondersteunt bewust alleen de twee
 * vormen die dit project gebruikt: elk uur ("0 * * * *") en één keer per dag
 * ("0 16 * * *"). Een andere vorm hoort hier op te vallen, niet stil door te
 * glippen.
 */
function intervalHoursOf(schedule: string): number {
  const [, hour] = schedule.split(" ");
  if (hour === "*") return 1;
  if (/^\d+$/.test(hour)) return 24;
  throw new Error(`onbekende cron-vorm: ${schedule}`);
}

test("REMINDER_CRON_INTERVAL_HOURS komt overeen met het schema in vercel.json", () => {
  const vercel = JSON.parse(readFileSync("vercel.json", "utf8")) as {
    crons: { path: string; schedule: string }[];
  };
  const cron = vercel.crons.find((c) => c.path === "/api/cron/class-reminders");
  assert.ok(cron, "class-reminders ontbreekt in vercel.json");
  assert.equal(
    intervalHoursOf(cron.schedule),
    REMINDER_CRON_INTERVAL_HOURS,
    "wijzig je het cron-schema, wijzig dan REMINDER_CRON_INTERVAL_HOURS mee (lib/class-attendance.ts)"
  );
});

const HOUR = 3_600_000;
const now = new Date("2026-09-10T12:00:00Z");
const inHours = (h: number) => new Date(now.getTime() + h * HOUR);

test("dagelijkse cron: de laatste run vóór de les stuurt altijd, ook vóór de ingestelde voorsprong", () => {
  // Les over 20 uur, gewenste voorsprong 14 uur. De volgende run is pas over
  // 24 uur en valt dus ná de start: nu-of-nooit.
  assert.equal(
    reminderDue({ startsAt: inHours(20), now, remindHoursBefore: 14, runIntervalHours: 24 }),
    true
  );
  // Les over 40 uur: de run van morgen is nog op tijd, dus nu overslaan.
  assert.equal(
    reminderDue({ startsAt: inHours(40), now, remindHoursBefore: 14, runIntervalHours: 24 }),
    false
  );
});

test("uurlijkse cron: de ingestelde voorsprong wordt exact gevolgd", () => {
  assert.equal(
    reminderDue({ startsAt: inHours(20), now, remindHoursBefore: 14, runIntervalHours: 1 }),
    false
  );
  assert.equal(
    reminderDue({ startsAt: inHours(14), now, remindHoursBefore: 14, runIntervalHours: 1 }),
    true
  );
  assert.equal(
    reminderDue({ startsAt: inHours(2), now, remindHoursBefore: 2, runIntervalHours: 1 }),
    true
  );
});

test("een les die al begonnen is krijgt geen herinnering meer", () => {
  assert.equal(
    reminderDue({ startsAt: now, now, remindHoursBefore: 14, runIntervalHours: 24 }),
    false
  );
  assert.equal(
    reminderDue({ startsAt: inHours(-1), now, remindHoursBefore: 14, runIntervalHours: 24 }),
    false
  );
});
