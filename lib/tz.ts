// Pure tijdzone-helpers voor `datetime-local`-invoer (géén `server-only`, ook
// client-bruikbaar; getest in tests/tz.test.ts).
//
// Waarom dit bestaat: een `<input type="datetime-local">` levert "2026-09-01T18:00"
// zónder zone. `new Date(...)` daarop leest **servertijd**: lokaal (Amsterdam)
// klopt dat toevallig, op Vercel (UTC) wordt "18:00" opgeslagen als 18:00 UTC =
// 20:00 in de sportschool. Een les hoort bij de klok van de vestiging
// (`Location.timezone`), dus parsen en terugschrijven gaan altijd via die zone.
// Geen dependency (date-fns-tz): de offset wordt met `Intl` afgeleid.

const LOCAL_INPUT_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

const partsCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let fmt = partsCache.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    partsCache.set(timeZone, fmt);
  }
  return fmt;
}

/** Klokonderdelen van `date` in `timeZone`. */
export function zonedParts(
  date: Date,
  timeZone: string
): { year: number; month: number; day: number; hour: number; minute: number; second: number } {
  const p: Record<string, number> = {};
  for (const part of partsFormatter(timeZone).formatToParts(date)) {
    if (part.type !== "literal") p[part.type] = Number(part.value);
  }
  return {
    year: p.year,
    month: p.month,
    day: p.day,
    hour: p.hour === 24 ? 0 : p.hour,
    minute: p.minute,
    second: p.second,
  };
}

/** Offset (ms) van `timeZone` t.o.v. UTC op het moment `date`. */
export function tzOffsetMs(date: Date, timeZone: string): number {
  const z = zonedParts(date, timeZone);
  const asUtc = Date.UTC(z.year, z.month - 1, z.day, z.hour, z.minute, z.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/**
 * "YYYY-MM-DDTHH:mm[:ss]" gelezen als klok in `timeZone` → absolute `Date`.
 * Ongeldig formaat → null. Rond een DST-overgang wint de tweede iteratie (de
 * offset ná de sprong), wat overeenkomt met wat een wekker op die klok doet.
 */
export function zonedInputToDate(input: string, timeZone: string): Date | null {
  const m = LOCAL_INPUT_RE.exec(input.trim());
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1, 6).map(Number);
  const s = m[6] ? Number(m[6]) : 0;
  // Date.UTC "rolt" ongeldige waarden door (maand 13 → januari); dat is hier
  // een invoerfout, geen bedoeling.
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 59) return null;
  const wall = Date.UTC(y, mo - 1, d, h, mi, s);
  if (Number.isNaN(wall) || new Date(wall).getUTCMonth() !== mo - 1) return null;
  // Eerste gok: alsof de offset van dat moment-als-UTC geldt; tweede iteratie
  // corrigeert als we daarmee net over een DST-grens vielen.
  const guess = wall - tzOffsetMs(new Date(wall), timeZone);
  const refined = wall - tzOffsetMs(new Date(guess), timeZone);
  return new Date(refined);
}

/** Absolute `Date` → "YYYY-MM-DDTHH:mm" in `timeZone` (voor `datetime-local`-defaults). */
export function dateToZonedInput(date: Date, timeZone: string): string {
  const z = zonedParts(date, timeZone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${z.year}-${pad(z.month)}-${pad(z.day)}T${pad(z.hour)}:${pad(z.minute)}`;
}

/** Zelfde klokmoment `weeks` weken later (DST-veilig: via de klok, niet via ms). */
export function addWeeksZoned(date: Date, weeks: number, timeZone: string): Date {
  const z = zonedParts(date, timeZone);
  const wall = Date.UTC(z.year, z.month - 1, z.day + weeks * 7, z.hour, z.minute, z.second);
  const guess = wall - tzOffsetMs(new Date(wall), timeZone);
  return new Date(wall - tzOffsetMs(new Date(guess), timeZone));
}

/**
 * Verschil tussen twee momenten gemeten op de **klok** van `timeZone` (ms).
 * "Dinsdag 18:00 → dinsdag 19:00" is altijd één uur, ook als er een
 * DST-overgang tussen de twee absolute tijdstippen ligt.
 */
export function wallClockDeltaMs(from: Date, to: Date, timeZone: string): number {
  const a = zonedParts(from, timeZone);
  const b = zonedParts(to, timeZone);
  return (
    Date.UTC(b.year, b.month - 1, b.day, b.hour, b.minute, b.second) -
    Date.UTC(a.year, a.month - 1, a.day, a.hour, a.minute, a.second)
  );
}

/**
 * Verschuif `date` met een klok-delta in `timeZone` (DST-veilig, zelfde
 * dubbele-iteratie als `zonedInputToDate`). Samen met `wallClockDeltaMs` de
 * basis van "bewerk ook alle volgende in de reeks": de wijziging aan één
 * sessie wordt als klokverschuiving op de rest toegepast, zodat een reeks
 * over de zomertijd heen op dezelfde lokale tijd blijft staan.
 */
export function shiftWallClock(date: Date, deltaMs: number, timeZone: string): Date {
  const z = zonedParts(date, timeZone);
  const wall = Date.UTC(z.year, z.month - 1, z.day, z.hour, z.minute, z.second) + deltaMs;
  const guess = wall - tzOffsetMs(new Date(wall), timeZone);
  return new Date(wall - tzOffsetMs(new Date(guess), timeZone));
}
