// Pure-logica-tests voor de weekdagplanning van de ledenagenda
// (lib/calendar-plan.ts). Geen testframework-dependency: Node's `node:test`
// via tsx. Draaien: `npx tsx --test tests/calendar-plan.test.ts` (of `npm test`).
//
// Datumfeiten in deze tests: 2026-09-07 is een maandag, 2026-09-13 een zondag;
// week A = 2026-08-31 t/m 2026-09-06, week B = 2026-09-07 t/m 2026-09-13.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addDaysToDayKey,
  carryOverWeekdayPlan,
  isoWeekdayOfDayKey,
  isValidDayKey,
  isValidMonthKey,
  monthGridDayKeys,
  monthKeyOfDayKey,
  nextMonthKey,
  parseWeekdayPlan,
  plannedDayIdsOnDate,
  plannedDayStatuses,
  prevMonthKey,
  weekStartKeyOfDayKey,
  type DayRef,
  type WeekdayPlan,
} from "../lib/calendar-plan";

// ---------- parseWeekdayPlan ----------

test("parseWeekdayPlan accepteert een geldige vorm en normaliseert weekdagen", () => {
  const plan = parseWeekdayPlan({
    setAt: "2026-09-01",
    days: { d1: [3, 1, 3], d2: [7] },
  });
  assert.deepEqual(plan, { setAt: "2026-09-01", days: { d1: [1, 3], d2: [7] } });
});

test("parseWeekdayPlan wijst structureel kapotte input af", () => {
  assert.equal(parseWeekdayPlan(null), null);
  assert.equal(parseWeekdayPlan("plan"), null);
  assert.equal(parseWeekdayPlan([1, 2]), null);
  assert.equal(parseWeekdayPlan({ days: { d1: [1] } }), null); // geen setAt
  assert.equal(parseWeekdayPlan({ setAt: "2026-09-01" }), null); // geen days
  assert.equal(parseWeekdayPlan({ setAt: "2026-09-01", days: [1] }), null);
});

test("parseWeekdayPlan wijst een ongeldige setAt af", () => {
  assert.equal(parseWeekdayPlan({ setAt: "gisteren", days: { d1: [1] } }), null);
  assert.equal(parseWeekdayPlan({ setAt: "2026-13-01", days: { d1: [1] } }), null);
  assert.equal(parseWeekdayPlan({ setAt: "2026-02-30", days: { d1: [1] } }), null);
});

test("parseWeekdayPlan laat ongeldige weekdagwaarden en lege entries vervallen", () => {
  const plan = parseWeekdayPlan({
    setAt: "2026-09-01",
    days: { d1: [0, 8, 2.5, "3", 4], d2: [], d3: "ma", d4: [9] },
  });
  assert.deepEqual(plan, { setAt: "2026-09-01", days: { d1: [4] } });
});

test("parseWeekdayPlan zonder overgebleven entries is geen plan", () => {
  assert.equal(parseWeekdayPlan({ setAt: "2026-09-01", days: {} }), null);
  assert.equal(parseWeekdayPlan({ setAt: "2026-09-01", days: { d1: [0] } }), null);
});

// ---------- dayKey-helpers ----------

test("isoWeekdayOfDayKey volgt ISO 8601 (1=ma, 7=zo)", () => {
  assert.equal(isoWeekdayOfDayKey("2026-09-07"), 1); // maandag
  assert.equal(isoWeekdayOfDayKey("2026-09-13"), 7); // zondag
  assert.equal(isoWeekdayOfDayKey("2026-09-09"), 3); // woensdag
});

test("weekStartKeyOfDayKey geeft de maandag van de ISO-week, ook over de jaargrens", () => {
  assert.equal(weekStartKeyOfDayKey("2026-09-09"), "2026-09-07");
  assert.equal(weekStartKeyOfDayKey("2026-09-07"), "2026-09-07"); // maandag zelf
  assert.equal(weekStartKeyOfDayKey("2026-09-13"), "2026-09-07"); // zondag hoort er nog bij
  assert.equal(weekStartKeyOfDayKey("2026-01-01"), "2025-12-29"); // jaarwissel
});

test("addDaysToDayKey telt over maand- en jaargrenzen heen", () => {
  assert.equal(addDaysToDayKey("2026-08-31", 1), "2026-09-01");
  assert.equal(addDaysToDayKey("2026-12-31", 1), "2027-01-01");
  assert.equal(addDaysToDayKey("2026-09-01", -1), "2026-08-31");
});

test("isValidDayKey en isValidMonthKey keuren randgevallen", () => {
  assert.equal(isValidDayKey("2026-02-28"), true);
  assert.equal(isValidDayKey("2026-02-30"), false);
  assert.equal(isValidMonthKey("2026-09"), true);
  assert.equal(isValidMonthKey("2026-9"), false);
  assert.equal(isValidMonthKey("2026-00"), false);
  assert.equal(isValidMonthKey("2026-13"), false);
  assert.equal(monthKeyOfDayKey("2026-09-07"), "2026-09");
});

// ---------- maandraster ----------

test("monthGridDayKeys loopt van de maandag voor de 1e tot de zondag na de laatste dag", () => {
  const keys = monthGridDayKeys("2026-09"); // 1 sep = dinsdag, 30 sep = woensdag
  assert.equal(keys[0], "2026-08-31");
  assert.equal(keys[keys.length - 1], "2026-10-04");
  assert.equal(keys.length, 35);
  assert.equal(keys.length % 7, 0);
});

test("monthGridDayKeys: een maand die exact op ma/zo valt krijgt geen randdagen", () => {
  const keys = monthGridDayKeys("2027-02"); // 1 feb 2027 = maandag, 28 feb = zondag
  assert.equal(keys[0], "2027-02-01");
  assert.equal(keys[keys.length - 1], "2027-02-28");
  assert.equal(keys.length, 28);
});

test("monthGridDayKeys over de jaargrens heen", () => {
  const keys = monthGridDayKeys("2026-12"); // 1 dec = dinsdag, 31 dec = donderdag
  assert.equal(keys[0], "2026-11-30");
  assert.equal(keys[keys.length - 1], "2027-01-03");
});

test("prevMonthKey/nextMonthKey zijn jaarwissel-veilig", () => {
  assert.equal(prevMonthKey("2026-01"), "2025-12");
  assert.equal(prevMonthKey("2026-09"), "2026-08");
  assert.equal(nextMonthKey("2026-12"), "2027-01");
  assert.equal(nextMonthKey("2026-09"), "2026-10");
});

// ---------- carryOverWeekdayPlan ----------

const plan: WeekdayPlan = { setAt: "2026-08-03", days: { o1: [1, 4], o2: [3] } };
const oldDays: DayRef[] = [
  { id: "o1", name: "Push", order: 0 },
  { id: "o2", name: "Pull", order: 1 },
];

test("carry-over matcht op naam, ook als de volgorde is veranderd", () => {
  const newDays: DayRef[] = [
    { id: "n1", name: "Pull", order: 0 },
    { id: "n2", name: "push ", order: 1 }, // andere case + spatie: matcht alsnog
  ];
  const out = carryOverWeekdayPlan(plan, oldDays, newDays);
  assert.deepEqual(out, { setAt: "2026-08-03", days: { n2: [1, 4], n1: [3] } });
});

test("carry-over valt terug op volgorde als de naam niet meer bestaat", () => {
  const newDays: DayRef[] = [
    { id: "n1", name: "Dag A", order: 0 },
    { id: "n2", name: "Dag B", order: 1 },
  ];
  const out = carryOverWeekdayPlan(plan, oldDays, newDays);
  assert.deepEqual(out, { setAt: "2026-08-03", days: { n1: [1, 4], n2: [3] } });
});

test("carry-over laat ongematchte dagen vervallen en behoudt setAt", () => {
  const newDays: DayRef[] = [{ id: "n1", name: "Push", order: 5 }];
  const out = carryOverWeekdayPlan(plan, oldDays, newDays);
  assert.deepEqual(out, { setAt: "2026-08-03", days: { n1: [1, 4] } });
});

test("carry-over zonder enige match is geen plan meer", () => {
  assert.equal(carryOverWeekdayPlan(plan, oldDays, []), null);
});

test("carry-over met dubbele namen kiest op volgorde en verdeelt uniek", () => {
  const dupPlan: WeekdayPlan = { setAt: "2026-08-03", days: { o1: [1], o2: [5] } };
  const dupOld: DayRef[] = [
    { id: "o1", name: "Dag", order: 0 },
    { id: "o2", name: "Dag", order: 1 },
  ];
  const dupNew: DayRef[] = [
    { id: "n1", name: "Dag", order: 0 },
    { id: "n2", name: "Dag", order: 1 },
  ];
  const out = carryOverWeekdayPlan(dupPlan, dupOld, dupNew);
  assert.deepEqual(out?.days, { n1: [1], n2: [5] });
});

// ---------- plannedDayStatuses ----------

const basePlan: WeekdayPlan = { setAt: "2026-08-03", days: { d1: [1] } }; // maandagen
const todayKey = "2026-09-09"; // woensdag, week B

function statuses(over: Partial<Parameters<typeof plannedDayStatuses>[0]>) {
  return plannedDayStatuses({
    plan: basePlan,
    dayKey: "2026-09-07",
    todayKey,
    sessionsOfWeek: [],
    windowStartKey: null,
    windowEndKey: null,
    ...over,
  });
}

test("gepland op deze weekdag verschijnt, andere weekdagen niet", () => {
  assert.deepEqual(plannedDayIdsOnDate(basePlan, "2026-09-07"), ["d1"]);
  assert.deepEqual(plannedDayIdsOnDate(basePlan, "2026-09-08"), []);
  assert.equal(statuses({ dayKey: "2026-09-08" }).length, 0);
});

test("sessie met hetzelfde dayId op dezelfde dag = done", () => {
  const out = statuses({ sessionsOfWeek: [{ dayId: "d1", dayKey: "2026-09-07" }] });
  assert.deepEqual(out, [{ dayId: "d1", status: "done" }]);
});

test("zelfde dayId elders in dezelfde ISO-week = verschoven, niet gemist", () => {
  const out = statuses({ sessionsOfWeek: [{ dayId: "d1", dayKey: "2026-09-08" }] });
  assert.deepEqual(out, [{ dayId: "d1", status: "shifted" }]);
});

test("een sessie zonder dayId op dezelfde datum telt als done", () => {
  const out = statuses({ sessionsOfWeek: [{ dayId: null, dayKey: "2026-09-07" }] });
  assert.deepEqual(out, [{ dayId: "d1", status: "done" }]);
});

test("een dayId-loze sessie dekt maximaal een geplande dag", () => {
  const twoOnMonday: WeekdayPlan = { setAt: "2026-08-03", days: { d1: [1], d2: [1] } };
  const out = statuses({
    plan: twoOnMonday,
    sessionsOfWeek: [{ dayId: null, dayKey: "2026-09-07" }],
  });
  assert.deepEqual(out, [
    { dayId: "d1", status: "done" },
    { dayId: "d2", status: "pending" }, // zelfde week als vandaag, dus neutraal
  ]);
});

test("afgesloten week zonder sessie = missed", () => {
  const out = statuses({ dayKey: "2026-08-31" }); // maandag week A, vandaag zit in week B
  assert.deepEqual(out, [{ dayId: "d1", status: "missed" }]);
});

test("verschoven-regel redt ook een afgesloten week", () => {
  const out = statuses({
    dayKey: "2026-08-31",
    sessionsOfWeek: [{ dayId: "d1", dayKey: "2026-09-02" }], // zelfde week A
  });
  assert.deepEqual(out, [{ dayId: "d1", status: "shifted" }]);
});

test("gepasseerde dag in de lopende week is neutraal (pending), vandaag ook", () => {
  const tuesdayPlan: WeekdayPlan = { setAt: "2026-08-03", days: { d1: [2, 3] } };
  const passed = statuses({ plan: tuesdayPlan, dayKey: "2026-09-08" }); // gisteren
  assert.deepEqual(passed, [{ dayId: "d1", status: "pending" }]);
  const today = statuses({ plan: tuesdayPlan, dayKey: "2026-09-09" });
  assert.deepEqual(today, [{ dayId: "d1", status: "pending" }]);
});

test("toekomstige geplande dag = upcoming", () => {
  const out = statuses({ dayKey: "2026-09-14" }); // volgende maandag
  assert.deepEqual(out, [{ dayId: "d1", status: "upcoming" }]);
});

test("voor setAt bestaat er geen verwachting", () => {
  const late: WeekdayPlan = { setAt: "2026-09-01", days: { d1: [1] } };
  assert.equal(statuses({ plan: late, dayKey: "2026-08-31" }).length, 0);
});

test("buiten het toewijzingsvenster bestaat er geen verwachting", () => {
  assert.equal(statuses({ windowStartKey: "2026-09-08" }).length, 0);
  assert.equal(statuses({ dayKey: "2026-09-14", windowEndKey: "2026-09-10" }).length, 0);
});

test("ISO-weekgrens: zondag hoort bij de week, de maandag erna niet meer", () => {
  // Sessie op zondag redt een geplande maandag van dezelfde week.
  const sunday = statuses({ sessionsOfWeek: [{ dayId: "d1", dayKey: "2026-09-13" }] });
  assert.deepEqual(sunday, [{ dayId: "d1", status: "shifted" }]);
  // Sessie op maandag van week B redt week A niet.
  const nextMonday = statuses({
    dayKey: "2026-08-31",
    sessionsOfWeek: [{ dayId: "d1", dayKey: "2026-09-07" }],
  });
  assert.deepEqual(nextMonday, [{ dayId: "d1", status: "missed" }]);
});
