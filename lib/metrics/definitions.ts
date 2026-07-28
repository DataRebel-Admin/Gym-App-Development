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
  status: "ENROLLED" | "CANCELLED" | "ATTENDED" | "NO_SHOW";
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
