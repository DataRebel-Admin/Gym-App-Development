const DATETIME_FMT = new Intl.DateTimeFormat("nl-NL", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const TIME_FMT = new Intl.DateTimeFormat("nl-NL", {
  hour: "2-digit",
  minute: "2-digit",
});

/** bv. "do 2 jul 18:00" */
export function formatSessionStart(d: Date): string {
  return DATETIME_FMT.format(d);
}

/** bv. "18:00–19:00" */
export function formatTimeRange(start: Date, end: Date): string {
  return `${TIME_FMT.format(start)}–${TIME_FMT.format(end)}`;
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
  return DATETIME_FMT.format(d);
}
