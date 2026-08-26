// Pure, gedeelde telregels voor organisatie-/vestigingsanalytics — de éne bron
// van waarheid, zodat geen endpoint z'n eigen (afwijkende) definitie bouwt.
// Geen `server-only` (idioom lib/exercise-types.ts): los testbaar via tsx
// (tests/location-metrics.test.ts) en client-bruikbaar voor labels.
//
// Kernafspraken (zie CLAUDE.md "Organisatie → Vestigingen"):
// - Een BEZOEK = een trainingssessie óf een als aanwezig gemarkeerde
//   les-deelname. Bezoeken zijn per vestiging optelbaar.
// - ACTIEVE LEDEN telt unieke lidmaatschappen. Op organisatie-niveau = distinct
//   leden; per vestiging = distinct leden die dáár actief waren. Een lid dat op
//   meerdere vestigingen traint telt per vestiging mee → vestigingstotalen
//   tellen bewust NIET op tot het organisatie-totaal (label dit in de UI).
// - RETENTIE = van de leden met ≥1 bezoek in maand M, het aandeel dat óók in
//   maand M+1 een bezoek had (maandgrenzen in de tijdzone van de vestiging).
// - Dag-/uur-bucketing gebeurt ALTIJD in de tijdzone van de vestiging
//   (Location.timezone) — nooit in de servertijdzone.

/** Eén bezoek: wie, waar, wanneer. */
export type VisitRow = { userId: string; locationId: string; at: Date };

/**
 * Dé definitie van een "actief lid" als Prisma-`where`-fragment op User.
 * (`role` als literal zodat dit bestand geen Prisma-runtime nodig heeft.)
 */
export const ACTIVE_MEMBER_WHERE = {
  role: "TENANT_MEMBER",
  active: true,
  archivedAt: null,
} as const;

/**
 * Unieke actieve leden: organisatie-breed (distinct over alles) én per
 * vestiging (distinct per vestiging). LET OP: som(perLocation) ≥ org — bewust.
 */
export function activeMemberCounts(visits: VisitRow[]): {
  org: number;
  perLocation: Map<string, number>;
} {
  const orgUsers = new Set<string>();
  const byLocation = new Map<string, Set<string>>();
  for (const v of visits) {
    orgUsers.add(v.userId);
    let set = byLocation.get(v.locationId);
    if (!set) byLocation.set(v.locationId, (set = new Set()));
    set.add(v.userId);
  }
  return {
    org: orgUsers.size,
    perLocation: new Map([...byLocation].map(([loc, set]) => [loc, set.size])),
  };
}

/** Bezoeken per vestiging — deze zíjn zuiver optelbaar (som = org-totaal). */
export function visitsPerLocation(visits: VisitRow[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const v of visits) counts.set(v.locationId, (counts.get(v.locationId) ?? 0) + 1);
  return counts;
}

// --- Tijdzone-bewuste bucketing ---------------------------------------------

const tzFormatters = new Map<string, Intl.DateTimeFormat>();
function tzFormatter(timeZone: string): Intl.DateTimeFormat {
  let fmt = tzFormatters.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      hour: "numeric",
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
    });
    tzFormatters.set(timeZone, fmt);
  }
  return fmt;
}

const WEEKDAY_INDEX: Record<string, number> = {
  Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6,
};

/** Weekdag (0 = maandag … 6 = zondag) + uur (0–23) van `date` in `timeZone`. */
export function hourPartsInTz(date: Date, timeZone: string): { weekday: number; hour: number } {
  const parts = tzFormatter(timeZone).formatToParts(date);
  let weekday = 0;
  let hour = 0;
  for (const p of parts) {
    if (p.type === "weekday") weekday = WEEKDAY_INDEX[p.value] ?? 0;
    else if (p.type === "hour") hour = Number(p.value);
  }
  return { weekday, hour };
}

/** Kalendermaand-sleutel ("2026-07") van `date` in `timeZone`. */
export function monthKeyInTz(date: Date, timeZone: string): string {
  const parts = tzFormatter(timeZone).formatToParts(date);
  let year = "";
  let month = "";
  for (const p of parts) {
    if (p.type === "year") year = p.value;
    else if (p.type === "month") month = p.value;
  }
  return `${year}-${month}`;
}

export type OccupancyCell = {
  locationId: string;
  weekday: number; // 0 = maandag … 6 = zondag
  hour: number; // 0–23
  count: number;
};

/**
 * Bezetting per (vestiging, weekdag, uur) — gebucket in de tijdzone van de
 * vestiging (`timezoneByLocation`; ontbrekend → Europe/Amsterdam-fallback is
 * de verantwoordelijkheid van de caller, hier UTC-veilig "Europe/Amsterdam").
 */
export function occupancyByHour(
  visits: VisitRow[],
  timezoneByLocation: Map<string, string>
): OccupancyCell[] {
  const cells = new Map<string, OccupancyCell>();
  for (const v of visits) {
    const tz = timezoneByLocation.get(v.locationId) ?? "Europe/Amsterdam";
    const { weekday, hour } = hourPartsInTz(v.at, tz);
    const key = `${v.locationId}|${weekday}|${hour}`;
    const cell = cells.get(key);
    if (cell) cell.count += 1;
    else cells.set(key, { locationId: v.locationId, weekday, hour, count: 1 });
  }
  return [...cells.values()];
}

// --- Tijdreeks-buckets (dag/week) --------------------------------------------

/** Korrel van een tijdreeks: 7 dagen → per dag, 30/90 dagen → per week. */
export type Granularity = "day" | "week";

export function granularityForWindow(windowDays: number): Granularity {
  return windowDays <= 7 ? "day" : "week";
}

const dateFormatters = new Map<string, Intl.DateTimeFormat>();
function dateFormatter(timeZone: string): Intl.DateTimeFormat {
  let fmt = dateFormatters.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    dateFormatters.set(timeZone, fmt);
  }
  return fmt;
}

function dateParts(date: Date, timeZone: string): { y: number; m: number; d: number; weekday: number } {
  const parts = dateFormatter(timeZone).formatToParts(date);
  let y = 0, m = 0, d = 0, weekday = 0;
  for (const p of parts) {
    if (p.type === "year") y = Number(p.value);
    else if (p.type === "month") m = Number(p.value);
    else if (p.type === "day") d = Number(p.value);
    else if (p.type === "weekday") weekday = WEEKDAY_INDEX[p.value] ?? 0;
  }
  return { y, m, d, weekday };
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Kalenderdag-sleutel ("2026-07-29") van `date` in `timeZone`. */
export function dayKeyInTz(date: Date, timeZone: string): string {
  const { y, m, d } = dateParts(date, timeZone);
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

/**
 * Maandag-sleutel ("2026-07-27") van de week waarin `date` valt, in `timeZone`
 * (weekdag 0 = maandag — bestaande conventie). DST-veilig: rekent op de
 * kalenderdatum via `Date.UTC`, niet op timestamps.
 */
export function weekStartKeyInTz(date: Date, timeZone: string): string {
  const { y, m, d, weekday } = dateParts(date, timeZone);
  const monday = new Date(Date.UTC(y, m - 1, d - weekday));
  return `${monday.getUTCFullYear()}-${pad2(monday.getUTCMonth() + 1)}-${pad2(monday.getUTCDate())}`;
}

export function bucketKeyInTz(date: Date, timeZone: string, granularity: Granularity): string {
  return granularity === "day" ? dayKeyInTz(date, timeZone) : weekStartKeyInTz(date, timeZone);
}

const DAY_MS = 86_400_000;

/**
 * De volledige, gesorteerde bucket-as voor het venster — inclusief lege buckets
 * (een chart mag geen gaten stilzwijgend overslaan). Dag-korrel: precies
 * `windowDays` dag-sleutels t/m vandaag. Week-korrel: alle weken die het
 * rollende venster raken (randbuckets zijn bewust partieel).
 */
export function enumerateBucketKeys(
  now: Date,
  windowDays: number,
  timeZone: string,
  granularity: Granularity
): string[] {
  const keys: string[] = [];
  const from = granularity === "day" ? windowDays - 1 : windowDays;
  for (let i = from; i >= 0; i--) {
    const key = bucketKeyInTz(new Date(now.getTime() - i * DAY_MS), timeZone, granularity);
    if (keys[keys.length - 1] !== key) keys.push(key);
  }
  return keys;
}

/** Telling per (vestiging, bucket) — generiek voor bezoeken én aanmeldingen. */
export function countPerBucket(
  rows: { locationId: string; at: Date }[],
  timezoneByLocation: Map<string, string>,
  granularity: Granularity
): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const tz = timezoneByLocation.get(r.locationId) ?? "Europe/Amsterdam";
    const key = bucketKeyInTz(r.at, tz, granularity);
    let buckets = out.get(r.locationId);
    if (!buckets) out.set(r.locationId, (buckets = new Map()));
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return out;
}

/** Eén afgeronde les-sessie met uitkomsten (caller aggregeert de enrollments). */
export type ClassSessionStat = {
  locationId: string;
  startsAt: Date;
  capacity: number;
  /** ENROLLED + ATTENDED (lib/class-attendance.ts ACTIVE_ENROLLMENT_STATUSES). */
  enrolledActive: number;
  attended: number;
  noShow: number;
};

export type ClassTrendBucket = {
  sessions: number;
  /** Σ enrolledActive / Σ capacity — null zonder capaciteit (geen noemer). */
  occupancyRate: number | null;
  /** Σ noShow / Σ (attended + noShow) — zelfde semantiek als noShowStatsPerLocation. */
  noShowRate: number | null;
};

/** Lesbezetting + no-show-rate per tijdbucket (in de tijdzone van de vestiging). */
export function classTrendPerBucket(
  rows: ClassSessionStat[],
  timezoneByLocation: Map<string, string>,
  granularity: Granularity
): Map<string, ClassTrendBucket> {
  const agg = new Map<string, { sessions: number; capacity: number; enrolled: number; attended: number; noShow: number }>();
  for (const r of rows) {
    const tz = timezoneByLocation.get(r.locationId) ?? "Europe/Amsterdam";
    const key = bucketKeyInTz(r.startsAt, tz, granularity);
    let a = agg.get(key);
    if (!a) agg.set(key, (a = { sessions: 0, capacity: 0, enrolled: 0, attended: 0, noShow: 0 }));
    a.sessions += 1;
    a.capacity += r.capacity;
    a.enrolled += r.enrolledActive;
    a.attended += r.attended;
    a.noShow += r.noShow;
  }
  const out = new Map<string, ClassTrendBucket>();
  for (const [key, a] of agg) {
    const expected = a.attended + a.noShow;
    out.set(key, {
      sessions: a.sessions,
      occupancyRate: a.capacity > 0 ? a.enrolled / a.capacity : null,
      noShowRate: expected > 0 ? a.noShow / expected : null,
    });
  }
  return out;
}

/** Totalen per weekdag (index 0 = maandag) uit heatmap-cellen van één vestiging. */
export function weekdayTotals(cells: OccupancyCell[]): number[] {
  const totals = new Array<number>(7).fill(0);
  for (const c of cells) totals[c.weekday] += c.count;
  return totals;
}

// --- Retentie & no-shows -----------------------------------------------------

/**
 * Maand-over-maand-retentie: het aandeel van de leden met ≥1 bezoek in maand M
 * (`current`) dat óók in maand M+1 (`next`) een bezoek had. `null` bij een lege
 * M (geen noemer). Caller levert de user-id's van beide maanden (al gescoped op
 * organisatie of vestiging).
 */
export function retentionRate(current: Iterable<string>, next: Iterable<string>): number | null {
  const cur = new Set(current);
  if (cur.size === 0) return null;
  const nxt = new Set(next);
  let kept = 0;
  for (const u of cur) if (nxt.has(u)) kept += 1;
  return kept / cur.size;
}

export type EnrollmentOutcomeRow = {
  locationId: string;
  /** Spiegelt `enum EnrollmentStatus`; WAITLISTED telt in geen enkele teller mee (zat niet in de les). */
  status: "ENROLLED" | "CANCELLED" | "ATTENDED" | "NO_SHOW" | "WAITLISTED";
};

export type NoShowStats = {
  attended: number;
  noShow: number;
  cancelled: number;
  /** noShow / (attended + noShow) — aandeel niet-verschenen van de verwachte deelnemers. */
  rate: number | null;
};

/** No-show-cijfers per vestiging uit afgehandelde les-aanmeldingen. */
export function noShowStatsPerLocation(rows: EnrollmentOutcomeRow[]): Map<string, NoShowStats> {
  const out = new Map<string, NoShowStats>();
  for (const r of rows) {
    let stats = out.get(r.locationId);
    if (!stats) out.set(r.locationId, (stats = { attended: 0, noShow: 0, cancelled: 0, rate: null }));
    if (r.status === "ATTENDED") stats.attended += 1;
    else if (r.status === "NO_SHOW") stats.noShow += 1;
    else if (r.status === "CANCELLED") stats.cancelled += 1;
  }
  for (const stats of out.values()) {
    const expected = stats.attended + stats.noShow;
    stats.rate = expected > 0 ? stats.noShow / expected : null;
  }
  return out;
}
