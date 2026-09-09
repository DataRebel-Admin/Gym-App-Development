// Pure-logica-tests voor het groeperen van groepslessen per lestype
// (lib/class-groups.ts), zoals de ledenlijst op /member/rooster ze toont.
// Geen testframework-dependency: Node's `node:test` via tsx. Draaien:
// `npx tsx --test tests/class-groups.test.ts` (of `npm test`).
//
// De interessante regel is welke sessie als "eerstvolgende" ingeklapt zichtbaar
// blijft: de lijst bevat óók lopende en geannuleerde sessies, die niet meer
// boekbaar zijn, terwijl een VOLLE les dat wél is (die levert een wachtlijst).

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  groupSessionsByClass,
  nextBookableSession,
  type GroupableSession,
} from "../lib/class-groups";

function session(over: Partial<GroupableSession> & { classId: string; startsAt: Date }): GroupableSession {
  return {
    className: "Spinning",
    cancelled: false,
    started: false,
    past: false,
    mine: null,
    ...over,
  };
}

const d = (iso: string) => new Date(iso);

test("groepeert op classId en houdt de aangeleverde volgorde aan", () => {
  const groups = groupSessionsByClass([
    session({ classId: "spin", className: "Spinning", startsAt: d("2026-09-10T18:00:00Z") }),
    session({ classId: "yoga", className: "Yoga", startsAt: d("2026-09-10T19:00:00Z") }),
    session({ classId: "spin", className: "Spinning", startsAt: d("2026-09-12T18:00:00Z") }),
  ]);

  assert.deepEqual(
    groups.map((g) => g.classId),
    ["spin", "yoga"],
    "groepsvolgorde volgt de eerste sessie per type, dus de eerstvolgende les eerst"
  );
  assert.equal(groups[0].sessions.length, 2);
  assert.equal(groups[1].sessions.length, 1);
  assert.deepEqual(
    groups[0].sessions.map((s) => s.startsAt.toISOString()),
    ["2026-09-10T18:00:00.000Z", "2026-09-12T18:00:00.000Z"],
    "binnen een groep blijft het chronologisch"
  );
});

test("twee lestypes met dezelfde naam blijven twee groepen", () => {
  // GroupClass heeft geen unique op (tenantId, name); op naam groeperen zou
  // de les van de ene instructeur bij die van de andere trekken.
  const groups = groupSessionsByClass([
    session({ classId: "a", className: "Bootcamp", startsAt: d("2026-09-10T18:00:00Z") }),
    session({ classId: "b", className: "Bootcamp", startsAt: d("2026-09-11T18:00:00Z") }),
  ]);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups.map((g) => g.className), ["Bootcamp", "Bootcamp"]);
});

test("de eerstvolgende slaat lopende, geannuleerde en voorbije sessies over", () => {
  const sessions = [
    session({ classId: "spin", startsAt: d("2026-09-01T18:00:00Z"), past: true }),
    session({ classId: "spin", startsAt: d("2026-09-09T18:00:00Z"), started: true }),
    session({ classId: "spin", startsAt: d("2026-09-10T18:00:00Z"), cancelled: true }),
    session({ classId: "spin", startsAt: d("2026-09-11T18:00:00Z") }),
  ];
  assert.equal(
    nextBookableSession(sessions)?.startsAt.toISOString(),
    "2026-09-11T18:00:00.000Z"
  );
  assert.equal(
    groupSessionsByClass(sessions)[0].next.startsAt.toISOString(),
    "2026-09-11T18:00:00.000Z"
  );
});

test("een volle les telt wel mee als eerstvolgende (vol = wachtlijst, geen dichte deur)", () => {
  // `full` zit bewust niet in GroupableSession: het mag de keuze niet sturen.
  const groups = groupSessionsByClass([
    session({ classId: "spin", startsAt: d("2026-09-11T18:00:00Z") }),
    session({ classId: "spin", startsAt: d("2026-09-12T18:00:00Z") }),
  ]);
  assert.equal(groups[0].next.startsAt.toISOString(), "2026-09-11T18:00:00.000Z");
});

test("zonder bruikbare sessie valt de eerstvolgende terug op de eerste", () => {
  const groups = groupSessionsByClass([
    session({ classId: "spin", startsAt: d("2026-09-09T18:00:00Z"), started: true }),
    session({ classId: "spin", startsAt: d("2026-09-10T18:00:00Z"), cancelled: true }),
  ]);
  assert.equal(nextBookableSession(groups[0].sessions), null);
  assert.equal(
    groups[0].next.startsAt.toISOString(),
    "2026-09-09T18:00:00.000Z",
    "een groep waarvan alles loopt of geschrapt is mag niet leeg ogen"
  );
});

test("hasMine slaat aan op aanmelding én wachtlijst", () => {
  const [none, enrolled, waitlisted] = groupSessionsByClass([
    session({ classId: "a", startsAt: d("2026-09-10T18:00:00Z") }),
    session({ classId: "b", startsAt: d("2026-09-10T19:00:00Z"), mine: "enrolled" }),
    session({ classId: "c", startsAt: d("2026-09-10T20:00:00Z"), mine: "waitlisted" }),
  ]);
  assert.equal(none.hasMine, false);
  assert.equal(enrolled.hasMine, true);
  assert.equal(waitlisted.hasMine, true);
});

test("een lege lijst levert geen groepen", () => {
  assert.deepEqual(groupSessionsByClass([]), []);
});
