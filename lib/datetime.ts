/**
 * Datum-/tijdweergave voor les- en sessietijden. Altijd met een expliciete
 * `timeZone`: de server draait in productie op UTC, dus zonder zone toont
 * "18:00" op Vercel een ander moment dan in de sportschool. Geef de tijdzone
 * van de **vestiging** mee (`Location.timezone`); `DEFAULT_TIMEZONE` is alleen
 * het vangnet voor call-sites zonder vestiging.
 */
export const DEFAULT_TIMEZONE = "Europe/Amsterdam";

const dtCache = new Map<string, Intl.DateTimeFormat>();
const dtYearCache = new Map<string, Intl.DateTimeFormat>();
const yearCache = new Map<string, Intl.DateTimeFormat>();
const timeCache = new Map<string, Intl.DateTimeFormat>();

function dateTimeFmt(timeZone: string): Intl.DateTimeFormat {
  let f = dtCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("nl-NL", {
      timeZone,
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
    dtCache.set(timeZone, f);
  }
  return f;
}

function dateTimeYearFmt(timeZone: string): Intl.DateTimeFormat {
  let f = dtYearCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("nl-NL", {
      timeZone,
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    dtYearCache.set(timeZone, f);
  }
  return f;
}

function yearFmt(timeZone: string): Intl.DateTimeFormat {
  let f = yearCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("nl-NL", { timeZone, year: "numeric" });
    yearCache.set(timeZone, f);
  }
  return f;
}

function timeFmt(timeZone: string): Intl.DateTimeFormat {
  let f = timeCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("nl-NL", { timeZone, hour: "2-digit", minute: "2-digit" });
    timeCache.set(timeZone, f);
  }
  return f;
}

/**
 * bv. "do 2 jul 18:00" — mét jaartal zodra de datum buiten het lopende jaar
 * valt ("do 2 jan 2027 18:00"): herhaalreeksen plannen tot een half jaar
 * vooruit, over de jaargrens heen, en zonder jaartal leest dat als vorig jaar.
 */
export function formatSessionStart(d: Date, timeZone: string = DEFAULT_TIMEZONE): string {
  const y = yearFmt(timeZone);
  const sameYear = y.format(d) === y.format(new Date());
  return (sameYear ? dateTimeFmt(timeZone) : dateTimeYearFmt(timeZone)).format(d);
}

/** bv. "18:00–19:00" */
export function formatTimeRange(start: Date, end: Date, timeZone: string = DEFAULT_TIMEZONE): string {
  return `${timeFmt(timeZone).format(start)}–${timeFmt(timeZone).format(end)}`;
}

/** Korte relatieve tijd in het NL, bv. "net", "3 u geleden", "2 d geleden". */
export function formatRelative(d: Date, now: Date = new Date()): string {
  const diffMs = now.getTime() - d.getTime();
  const min = Math.round(diffMs / 60000);
  if (min < 1) return "net";
  if (min < 60) return `${min} min geleden`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `${hours} u geleden`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} d geleden`;
  return dateTimeFmt(DEFAULT_TIMEZONE).format(d);
}
