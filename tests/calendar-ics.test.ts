// Pure-logica-tests voor de dependency-vrije ICS-generator
// (lib/calendar-ics.ts). Geen testframework-dependency: Node's `node:test`
// via tsx. Draaien: `npx tsx --test tests/calendar-ics.test.ts` (of `npm test`).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildIcs,
  escapeIcsText,
  foldIcsLine,
  type IcsCalendarMeta,
  type IcsEvent,
} from "../lib/calendar-ics";

const META: IcsCalendarMeta = {
  name: "FitPower Leeuwarden",
  timeZoneHint: "Europe/Amsterdam",
  uidDomain: "app.gymrebel-training.com",
};

const NOW = new Date("2026-09-08T10:15:30Z");

// ---------- escaping ----------

test("escapeIcsText ontsnapt backslash, puntkomma, komma en newline", () => {
  assert.equal(escapeIcsText("a\\b"), "a\\\\b");
  assert.equal(escapeIcsText("les; zaal 2, boven"), "les\\; zaal 2\\, boven");
  assert.equal(escapeIcsText("regel1\nregel2"), "regel1\\nregel2");
  assert.equal(escapeIcsText("regel1\r\nregel2"), "regel1\\nregel2");
});

// ---------- folding ----------

test("foldIcsLine laat korte regels ongemoeid", () => {
  assert.equal(foldIcsLine("SUMMARY:kort"), "SUMMARY:kort");
});

test("foldIcsLine vouwt op 75 octetten met CRLF + spatie", () => {
  const line = "SUMMARY:" + "a".repeat(200);
  const folded = foldIcsLine(line);
  const parts = folded.split("\r\n ");
  assert.ok(parts.length > 1);
  const encoder = new TextEncoder();
  // Eerste regel max 75 octetten; vervolgregels max 74 (de spatie telt mee).
  assert.ok(encoder.encode(parts[0]).length <= 75);
  for (const p of parts.slice(1)) {
    assert.ok(encoder.encode(p).length <= 74);
  }
  // Terugvouwen levert de oorspronkelijke regel op.
  assert.equal(parts.join(""), line);
});

test("foldIcsLine breekt nooit midden in een UTF-8-codepoint", () => {
  const line = "SUMMARY:" + "🏋️é".repeat(40);
  const folded = foldIcsLine(line);
  // Elke vervolgregel moet met een compleet teken beginnen; terugvouwen moet
  // exact de invoer opleveren (een gebroken codepoint zou dat slopen).
  assert.equal(folded.split("\r\n ").join(""), line);
  for (const part of folded.split("\r\n ")) {
    // Geen losse surrogates aan de randen.
    assert.ok(!/^[\uDC00-\uDFFF]/.test(part));
    assert.ok(!/[\uD800-\uDBFF]$/.test(part));
  }
});

// ---------- buildIcs ----------

const ALLDAY: IcsEvent = {
  kind: "allday",
  uid: "plan-a1-2026-09-14",
  dayKey: "2026-09-14",
  summary: "Training: Push",
};

const TIMED: IcsEvent = {
  kind: "timed",
  uid: "class-e1",
  startUtc: new Date("2026-09-14T17:30:00Z"),
  endUtc: new Date("2026-09-14T18:30:00Z"),
  summary: "Spinning",
  location: "Leeuwarden Centrum · Zaal 2",
  status: "TENTATIVE",
};

test("buildIcs gebruikt uitsluitend CRLF-regeleindes", () => {
  const ics = buildIcs(META, [ALLDAY, TIMED], NOW);
  assert.ok(ics.endsWith("\r\n"));
  assert.equal(ics.replace(/\r\n/g, "").includes("\n"), false);
  assert.equal(ics.replace(/\r\n/g, "").includes("\r"), false);
});

test("buildIcs zet de kalender-eigenschappen en de tijdzone-hint", () => {
  const ics = buildIcs(META, [], NOW);
  for (const expected of [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-TIMEZONE:Europe/Amsterdam",
    "REFRESH-INTERVAL;VALUE=DURATION:PT12H",
    "END:VCALENDAR",
  ]) {
    assert.ok(ics.includes(expected), `mist ${expected}`);
  }
});

test("hele-dag-event: VALUE=DATE met exclusieve DTEND (de dag erna)", () => {
  const ics = buildIcs(META, [ALLDAY], NOW);
  assert.ok(ics.includes("DTSTART;VALUE=DATE:20260914"));
  assert.ok(ics.includes("DTEND;VALUE=DATE:20260915"));
});

test("getimed event: UTC-tijden met Z-suffix en een LOCATION", () => {
  const ics = buildIcs(META, [TIMED], NOW);
  assert.ok(ics.includes("DTSTART:20260914T173000Z"));
  assert.ok(ics.includes("DTEND:20260914T183000Z"));
  assert.ok(ics.includes("LOCATION:Leeuwarden Centrum · Zaal 2"));
});

test("STATUS: TENTATIVE en CANCELLED worden uitgeschreven, CONFIRMED niet", () => {
  const cancelled: IcsEvent = { ...TIMED, uid: "class-e2", status: "CANCELLED" };
  const confirmed: IcsEvent = { ...TIMED, uid: "class-e3", status: "CONFIRMED" };
  const ics = buildIcs(META, [TIMED, cancelled, confirmed], NOW);
  assert.ok(ics.includes("STATUS:TENTATIVE"));
  assert.ok(ics.includes("STATUS:CANCELLED"));
  assert.equal(ics.includes("STATUS:CONFIRMED"), false);
});

test("UIDs zijn stabiel over twee builds; alleen DTSTAMP verschilt", () => {
  const later = new Date("2026-09-09T08:00:00Z");
  const a = buildIcs(META, [ALLDAY, TIMED], NOW);
  const b = buildIcs(META, [ALLDAY, TIMED], later);
  assert.ok(a.includes("UID:plan-a1-2026-09-14@app.gymrebel-training.com"));
  assert.ok(b.includes("UID:plan-a1-2026-09-14@app.gymrebel-training.com"));
  const strip = (s: string) => s.replace(/DTSTAMP:[0-9TZ]+/g, "DTSTAMP:X");
  assert.equal(strip(a), strip(b));
  assert.notEqual(a, b);
});

test("whitelabel: PRODID en kalendernaam dragen de gym-naam, geen platform-branding", () => {
  const ics = buildIcs(META, [], NOW);
  assert.ok(ics.includes("PRODID:-//FitPower Leeuwarden//Agenda//NL"));
  assert.ok(ics.includes("X-WR-CALNAME:FitPower Leeuwarden"));
  assert.equal(ics.toLowerCase().includes("gymrebel//"), false);
});

test("een samenvatting met komma's en newlines blijft een geldige regel", () => {
  const ev: IcsEvent = {
    ...ALLDAY,
    uid: "plan-a2",
    summary: "Push, pull\nen benen; alles",
  };
  const ics = buildIcs(META, [ev], NOW);
  assert.ok(ics.includes("SUMMARY:Push\\, pull\\nen benen\\; alles"));
});
