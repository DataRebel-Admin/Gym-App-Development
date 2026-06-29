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
