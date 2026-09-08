/**
 * Dependency-vrije iCalendar-generator (RFC 5545) voor de agendafeed van een
 * lid. Puur, géén `server-only` — getest in tests/calendar-ics.test.ts.
 *
 * Waarom geen npm-package: het benodigde deel van het formaat is klein en de
 * valkuilen (escaping, 75-octet line folding, CRLF, stabiele UIDs) zijn juist
 * de dingen die we hier expliciet willen vastleggen en testen.
 *
 * Ontwerpkeuzes:
 * - Getimede events in UTC ("...Z"): geen VTIMEZONE-blokken nodig, elke client
 *   lokaliseert zelf; `X-WR-TIMEZONE` geeft de weergave-hint.
 * - Hele-dag-events als VALUE=DATE met een EXCLUSIEVE DTEND (de dag erna).
 * - Stabiele UIDs (aangeleverd door de caller): een refetch vervangt bestaande
 *   events in plaats van ze te dupliceren; SEQUENCE is dan niet nodig.
 * - Geen VALARM: herinneringen zijn aan de kalender-app van het lid.
 */

export type IcsEventStatus = "CONFIRMED" | "TENTATIVE" | "CANCELLED";

export type IcsEvent =
  | {
      kind: "allday";
      uid: string;
      /** Kalenderdag "YYYY-MM-DD" (al in de juiste tijdzone bepaald). */
      dayKey: string;
      summary: string;
      description?: string;
      status?: IcsEventStatus;
    }
  | {
      kind: "timed";
      uid: string;
      startUtc: Date;
      endUtc: Date;
      summary: string;
      location?: string;
      description?: string;
      status?: IcsEventStatus;
    };

export type IcsCalendarMeta = {
  /** Kalendernaam (whitelabel: de sportschool, nooit platform-branding). */
  name: string;
  /** IANA-tijdzone als weergave-hint (X-WR-TIMEZONE). */
  timeZoneHint: string;
  /** Domein voor UIDs (bv. "app.gymrebel-training.com"). */
  uidDomain: string;
};

/** Escape voor TEXT-waarden: backslash, puntkomma, komma en newline. */
export function escapeIcsText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

const encoder = new TextEncoder();
const MAX_OCTETS = 75;

/**
 * Vouw een contentregel op 75 octetten (RFC 5545 §3.1): vervolgregels beginnen
 * met CRLF + spatie. Er wordt op UTF-8-BYTES geteld maar nooit midden in een
 * codepoint gebroken (een naïeve substring sloopt emoji en accenten).
 */
export function foldIcsLine(line: string): string {
  const out: string[] = [];
  let current = "";
  let octets = 0;
  // De leidende spatie van een vervolgregel telt mee in de 75 octetten.
  let budget = MAX_OCTETS;
  for (const ch of line) {
    const len = encoder.encode(ch).length;
    if (octets + len > budget) {
      out.push(current);
      current = "";
      octets = 0;
      budget = MAX_OCTETS - 1;
    }
    current += ch;
    octets += len;
  }
  out.push(current);
  return out.join("\r\n ");
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** UTC-tijdstempel "YYYYMMDDTHHMMSSZ". */
function icsUtc(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

/** "YYYY-MM-DD" → "YYYYMMDD". */
function icsDate(dayKey: string): string {
  return dayKey.replace(/-/g, "");
}

/** "YYYY-MM-DD" → de dag erna als "YYYYMMDD" (exclusieve DTEND). */
function icsDateNext(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return `${next.getUTCFullYear()}${pad(next.getUTCMonth() + 1)}${pad(next.getUTCDate())}`;
}

/** Bouw de volledige kalender: CRLF-regels, elk gevouwen op 75 octetten. */
export function buildIcs(meta: IcsCalendarMeta, events: IcsEvent[], now: Date): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${escapeIcsText(meta.name)}//Agenda//NL`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(meta.name)}`,
    `X-WR-TIMEZONE:${meta.timeZoneHint}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT12H",
    "X-PUBLISHED-TTL:PT12H",
  ];

  const stamp = icsUtc(now);
  for (const ev of events) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${ev.uid}@${meta.uidDomain}`);
    lines.push(`DTSTAMP:${stamp}`);
    if (ev.kind === "allday") {
      lines.push(`DTSTART;VALUE=DATE:${icsDate(ev.dayKey)}`);
      lines.push(`DTEND;VALUE=DATE:${icsDateNext(ev.dayKey)}`);
    } else {
      lines.push(`DTSTART:${icsUtc(ev.startUtc)}`);
      lines.push(`DTEND:${icsUtc(ev.endUtc)}`);
      if (ev.location) lines.push(`LOCATION:${escapeIcsText(ev.location)}`);
    }
    lines.push(`SUMMARY:${escapeIcsText(ev.summary)}`);
    if (ev.description) lines.push(`DESCRIPTION:${escapeIcsText(ev.description)}`);
    // CONFIRMED is de default in het formaat — alleen afwijkingen uitschrijven.
    if (ev.status && ev.status !== "CONFIRMED") lines.push(`STATUS:${ev.status}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
}
