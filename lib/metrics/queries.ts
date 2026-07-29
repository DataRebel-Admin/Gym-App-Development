import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import { getTenantLocations } from "@/lib/locations";
import {
  canRollUp,
  scopeCacheKey,
  scopeLocationIds,
  type LocationScope,
} from "@/lib/location-scope";
import { ACTIVE_ENROLLMENT_STATUSES, NO_SHOW_GRACE_HOURS } from "@/lib/class-attendance";
import {
  activeMemberCounts,
  visitsPerLocation,
  occupancyByHour,
  retentionRate,
  noShowStatsPerLocation,
  monthKeyInTz,
  granularityForWindow,
  enumerateBucketKeys,
  bucketKeyInTz,
  countPerBucket,
  classTrendPerBucket,
  type ClassSessionStat,
  type Granularity,
  type OccupancyCell,
  type VisitRow,
} from "@/lib/metrics/definitions";

/** Toegestane analysevensters voor /owner/insights. */
export type InsightsWindow = 7 | 30 | 90;

/**
 * Server-querylaag boven de pure telregels (lib/metrics/definitions.ts):
 * haalt bezoek-rijen op (trainingssessies + aanwezig-gemarkeerde les-deelnames),
 * gescoped op organisatie of vestigingen, en delegeert alle wiskunde aan de
 * pure kern. Alle publieke functies zijn `unstable_cache`-gewrapt mét
 * `scopeCacheKey(scope)` in de keyParts (verplicht — voorkomt scope-lek).
 * Vorm gekopieerd van lib/admin-dashboard.ts (per-entiteit-rijen + totalen).
 */

const DAY_MS = 86_400_000;

export type LocationHealthRow = {
  locationId: string;
  name: string;
  isDefault: boolean;
  /** Distinct leden actief op deze vestiging (30d) — NIET optelbaar naar org. */
  activeMembers: number;
  /** Bezoeken (30d) — wél optelbaar. */
  visits: number;
  /** Retentie: aandeel van vorige kalendermaand dat deze maand terugkeerde. */
  retention: number | null;
  /** No-show-cijfers over les-deelnames van de laatste 30 dagen. */
  attended: number;
  noShow: number;
  noShowRate: number | null;
  /** Drukste moment (weekdag 0=ma, uur) in de eigen tijdzone. */
  peak: { weekday: number; hour: number; count: number } | null;
};

export type LocationComparison = {
  windowDays: number;
  rows: LocationHealthRow[];
  /**
   * Geconsolideerd organisatie-totaal — alléén gevuld bij org-scope
   * (`canRollUp`); een gescopede manager krijgt bewust null (spec-test b).
   * `activeMembers` = distinct lidmaatschappen — som(rijen) telt een lid dat op
   * meerdere vestigingen traint dubbel; label dit in de UI (non-additive-note).
   */
  orgTotals: {
    activeMembers: number;
    visits: number;
    retention: number | null;
    noShowRate: number | null;
  } | null;
  /** Bezettingscellen (28d) per vestiging, gebucket in de vestiging-tijdzone. */
  occupancy: OccupancyCell[];
};

/** Bezoeken (sessies + ATTENDED-les-deelnames) binnen [since, until). */
async function fetchVisits(
  tenantId: string,
  locationIds: string[],
  since: Date,
  until?: Date
): Promise<VisitRow[]> {
  const range = { gte: since, ...(until ? { lt: until } : {}) };
  const locFilter = { locationId: { in: locationIds } };
  const [sessions, attended] = await Promise.all([
    prisma.workoutSession.findMany({
      where: { tenantId, ...locFilter, startedAt: range },
      select: { userId: true, locationId: true, startedAt: true },
    }),
    prisma.classEnrollment.findMany({
      where: {
        tenantId,
        status: "ATTENDED",
        session: { ...locFilter, startsAt: range },
      },
      select: { userId: true, session: { select: { locationId: true, startsAt: true } } },
    }),
  ]);
  return [
    ...sessions.map((s) => ({ userId: s.userId, locationId: s.locationId, at: s.startedAt })),
    ...attended.map((e) => ({
      userId: e.userId,
      locationId: e.session.locationId,
      at: e.session.startsAt,
    })),
  ];
}

async function computeLocationComparison(
  tenantId: string,
  scope: LocationScope,
  windowDays: InsightsWindow
): Promise<LocationComparison> {
  const all = await getTenantLocations(tenantId);
  const ids = new Set(scopeLocationIds(scope, all.map((l) => l.id)));
  const locations = all.filter((l) => ids.has(l.id));
  if (locations.length === 0) {
    return { windowDays, rows: [], orgTotals: null, occupancy: [] };
  }
  const locationIds = locations.map((l) => l.id);
  const tzByLocation = new Map(locations.map((l) => [l.id, l.timezone]));

  const now = new Date();
  const since30 = new Date(now.getTime() - windowDays * DAY_MS);
  // Retentie-venster: ruim genoeg voor de volledige vorige kalendermaand.
  const since65 = new Date(now.getTime() - 65 * DAY_MS);

  const [visits30, visitsRetention, enrollmentOutcomes] = await Promise.all([
    fetchVisits(tenantId, locationIds, since30),
    fetchVisits(tenantId, locationIds, since65),
    prisma.classEnrollment.findMany({
      where: {
        tenantId,
        status: { in: ["ATTENDED", "NO_SHOW", "CANCELLED"] },
        session: { locationId: { in: locationIds }, startsAt: { gte: since30 } },
      },
      select: { status: true, session: { select: { locationId: true } } },
    }),
  ]);

  const memberCounts = activeMemberCounts(visits30);
  const visitCounts = visitsPerLocation(visits30);
  const occupancy = occupancyByHour(visits30, tzByLocation);
  const noShows = noShowStatsPerLocation(
    enrollmentOutcomes.map((e) => ({
      locationId: e.session.locationId,
      status: e.status,
    }))
  );

  // Retentie: leden met bezoek in de vorige kalendermaand (tijdzone van de
  // vestiging) die ook in de lopende maand terugkwamen.
  const usersByLocationMonth = new Map<string, { prev: Set<string>; cur: Set<string> }>();
  const orgRetention = { prev: new Set<string>(), cur: new Set<string>() };
  const nowMonthByTz = new Map<string, string>();
  const prevMonthByTz = new Map<string, string>();
  for (const l of locations) {
    const tz = l.timezone;
    if (!nowMonthByTz.has(tz)) {
      nowMonthByTz.set(tz, monthKeyInTz(now, tz));
      // Vorige maand: 1e van deze maand min 1 dag benaderen via 28-35 dagen terug
      // is fragiel — leid 'm af uit de maand-sleutel zelf.
      const [y, m] = monthKeyInTz(now, tz).split("-").map(Number);
      const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
      prevMonthByTz.set(tz, prev);
    }
  }
  for (const v of visitsRetention) {
    const tz = tzByLocation.get(v.locationId) ?? "Europe/Amsterdam";
    const key = monthKeyInTz(v.at, tz);
    const bucket =
      key === prevMonthByTz.get(tz) ? "prev" : key === nowMonthByTz.get(tz) ? "cur" : null;
    if (!bucket) continue;
    let entry = usersByLocationMonth.get(v.locationId);
    if (!entry) usersByLocationMonth.set(v.locationId, (entry = { prev: new Set(), cur: new Set() }));
    entry[bucket].add(v.userId);
    orgRetention[bucket].add(v.userId);
  }

  const rows: LocationHealthRow[] = locations.map((l) => {
    const cells = occupancy.filter((c) => c.locationId === l.id);
    const peak = cells.reduce<OccupancyCell | null>(
      (best, c) => (best == null || c.count > best.count ? c : best),
      null
    );
    const retention = usersByLocationMonth.get(l.id);
    const ns = noShows.get(l.id);
    return {
      locationId: l.id,
      name: l.name,
      isDefault: l.isDefault,
      activeMembers: memberCounts.perLocation.get(l.id) ?? 0,
      visits: visitCounts.get(l.id) ?? 0,
      retention: retention ? retentionRate(retention.prev, retention.cur) : null,
      attended: ns?.attended ?? 0,
      noShow: ns?.noShow ?? 0,
      noShowRate: ns?.rate ?? null,
      peak: peak ? { weekday: peak.weekday, hour: peak.hour, count: peak.count } : null,
    };
  });

  let orgTotals: LocationComparison["orgTotals"] = null;
  if (canRollUp(scope)) {
    const totalAttended = rows.reduce((a, r) => a + r.attended, 0);
    const totalNoShow = rows.reduce((a, r) => a + r.noShow, 0);
    orgTotals = {
      activeMembers: memberCounts.org, // distinct lidmaatschappen — géén som van rijen
      visits: visits30.length, // bezoeken zijn wél optelbaar
      retention: retentionRate(orgRetention.prev, orgRetention.cur),
      noShowRate:
        totalAttended + totalNoShow > 0 ? totalNoShow / (totalAttended + totalNoShow) : null,
    };
  }

  return { windowDays, rows, orgTotals, occupancy };
}

export function getLocationComparison(
  tenantId: string,
  scope: LocationScope,
  windowDays: InsightsWindow = 30
): Promise<LocationComparison> {
  // Scope én venster verplicht in de keyParts (voorkomt scope-lek via de
  // gedeelde cache; zonder venster zouden 7/30/90 één entry delen).
  return unstable_cache(
    () => computeLocationComparison(tenantId, scope, windowDays),
    ["location-comparison", tenantId, String(windowDays), scopeCacheKey(scope)],
    { revalidate: 300 }
  )();
}

// --- Tijdreeks-trends voor /owner/insights -----------------------------------

export type TrendSeriesMeta = { locationId: string; name: string };

export type InsightsTrends = {
  windowDays: number;
  granularity: Granularity;
  /** Vestigingen binnen de scope (volgorde getTenantLocations: default eerst). */
  series: TrendSeriesMeta[];
  /**
   * Recharts-rijen: `{ bucket, total, [locationId]: n }` — per-vestiging-
   * kolommen alleen relevant bij meer dan één vestiging in de scope.
   */
  visits: Array<Record<string, string | number>>;
  visitsTotal: number;
  /** t.o.v. de voorgaande periode van gelijke lengte. */
  visitsTrendPct: number | null;
  signups: {
    points: { bucket: string; count: number }[];
    total: number;
    trendPct: number | null;
  };
  classes: {
    points: {
      bucket: string;
      occupancyPct: number | null;
      noShowPct: number | null;
      sessions: number;
    }[];
    avgOccupancyPct: number | null;
    noShowPct: number | null;
    sessionsTotal: number;
  };
};

function pctTrend(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 100);
}

const toPct = (v: number | null): number | null => (v == null ? null : Math.round(v * 100));

async function computeInsightsTrends(
  tenantId: string,
  scope: LocationScope,
  windowDays: InsightsWindow
): Promise<InsightsTrends> {
  const granularity = granularityForWindow(windowDays);
  const all = await getTenantLocations(tenantId);
  const ids = new Set(scopeLocationIds(scope, all.map((l) => l.id)));
  const locations = all.filter((l) => ids.has(l.id));
  const empty: InsightsTrends = {
    windowDays,
    granularity,
    series: [],
    visits: [],
    visitsTotal: 0,
    visitsTrendPct: null,
    signups: { points: [], total: 0, trendPct: null },
    classes: { points: [], avgOccupancyPct: null, noShowPct: null, sessionsTotal: 0 },
  };
  if (locations.length === 0) return empty;

  const locationIds = locations.map((l) => l.id);
  const tzByLocation = new Map(locations.map((l) => [l.id, l.timezone]));
  // As-tijdzone: de default-vestiging binnen de scope (getTenantLocations
  // sorteert die vooraan) — bucket-sleutels zijn kalenderdatums, dus
  // cross-vestiging-alignment is op kalenderdatum.
  const axisTz = locations[0].timezone;

  const now = new Date();
  const since = new Date(now.getTime() - windowDays * DAY_MS);
  const since2x = new Date(now.getTime() - 2 * windowDays * DAY_MS);
  // No-show-markering loopt NO_SHOW_GRACE_HOURS achter (cron) — recentere
  // lessen zouden de laatste bucket structureel te rooskleurig maken.
  const classCutoff = new Date(now.getTime() - NO_SHOW_GRACE_HOURS * 3_600_000);

  const signupScope =
    scope.kind === "locations" ? { homeLocationId: { in: scope.ids } } : {};

  const [allVisits, signupRows, classSessions] = await Promise.all([
    fetchVisits(tenantId, locationIds, since2x),
    prisma.user.findMany({
      where: {
        tenantId,
        role: "TENANT_MEMBER",
        ...signupScope,
        createdAt: { gte: since2x },
      },
      select: { createdAt: true, homeLocationId: true },
    }),
    prisma.classSession.findMany({
      where: {
        tenantId,
        locationId: { in: locationIds },
        startsAt: { gte: since },
        endsAt: { lt: classCutoff },
      },
      select: {
        startsAt: true,
        locationId: true,
        groupClass: { select: { maxParticipants: true } },
        enrollments: { select: { status: true } },
      },
    }),
  ]);

  const bucketKeys = enumerateBucketKeys(now, windowDays, axisTz, granularity);
  const multiSeries = locations.length > 1;

  // Bezoeken: huidige periode gebucket, vorige periode alleen voor de trend.
  const currentVisits = allVisits.filter((v) => v.at >= since);
  const prevVisitCount = allVisits.length - currentVisits.length;
  const visitBuckets = countPerBucket(currentVisits, tzByLocation, granularity);
  const visits = bucketKeys.map((bucket) => {
    const row: Record<string, string | number> = { bucket };
    let total = 0;
    for (const l of locations) {
      const n = visitBuckets.get(l.id)?.get(bucket) ?? 0;
      total += n;
      if (multiSeries) row[l.id] = n;
    }
    row.total = total;
    return row;
  });

  // Nieuwe leden: gebucket op de tijdzone van de thuisvestiging (fallback as-tz).
  const currentSignups = signupRows.filter((u) => u.createdAt >= since);
  const signupCounts = new Map<string, number>();
  for (const u of currentSignups) {
    const tz =
      (u.homeLocationId ? tzByLocation.get(u.homeLocationId) : undefined) ?? axisTz;
    const key = bucketKeyInTz(u.createdAt, tz, granularity);
    signupCounts.set(key, (signupCounts.get(key) ?? 0) + 1);
  }
  const signups = {
    points: bucketKeys.map((bucket) => ({ bucket, count: signupCounts.get(bucket) ?? 0 })),
    total: currentSignups.length,
    trendPct: pctTrend(currentSignups.length, signupRows.length - currentSignups.length),
  };

  // Lessen: per sessie de uitkomsten aggregeren, dan per bucket.
  const classStats: ClassSessionStat[] = classSessions.map((s) => {
    let enrolledActive = 0;
    let attended = 0;
    let noShow = 0;
    for (const e of s.enrollments) {
      if ((ACTIVE_ENROLLMENT_STATUSES as readonly string[]).includes(e.status)) enrolledActive += 1;
      if (e.status === "ATTENDED") attended += 1;
      else if (e.status === "NO_SHOW") noShow += 1;
    }
    return {
      locationId: s.locationId,
      startsAt: s.startsAt,
      capacity: s.groupClass.maxParticipants,
      enrolledActive,
      attended,
      noShow,
    };
  });
  const classBuckets = classTrendPerBucket(classStats, tzByLocation, granularity);
  const totalCapacity = classStats.reduce((a, s) => a + s.capacity, 0);
  const totalEnrolled = classStats.reduce((a, s) => a + s.enrolledActive, 0);
  const totalAttended = classStats.reduce((a, s) => a + s.attended, 0);
  const totalNoShow = classStats.reduce((a, s) => a + s.noShow, 0);
  const classes = {
    points: bucketKeys.map((bucket) => {
      const b = classBuckets.get(bucket);
      return {
        bucket,
        occupancyPct: toPct(b?.occupancyRate ?? null),
        noShowPct: toPct(b?.noShowRate ?? null),
        sessions: b?.sessions ?? 0,
      };
    }),
    avgOccupancyPct: totalCapacity > 0 ? Math.round((totalEnrolled / totalCapacity) * 100) : null,
    noShowPct:
      totalAttended + totalNoShow > 0
        ? Math.round((totalNoShow / (totalAttended + totalNoShow)) * 100)
        : null,
    sessionsTotal: classStats.length,
  };

  return {
    windowDays,
    granularity,
    series: locations.map((l) => ({ locationId: l.id, name: l.name })),
    visits,
    visitsTotal: currentVisits.length,
    visitsTrendPct: pctTrend(currentVisits.length, prevVisitCount),
    signups,
    classes,
  };
}

export function getInsightsTrends(
  tenantId: string,
  scope: LocationScope,
  windowDays: InsightsWindow
): Promise<InsightsTrends> {
  // CACHE-KEY-REGEL: venster én scope verplicht in de keyParts.
  return unstable_cache(
    () => computeInsightsTrends(tenantId, scope, windowDays),
    ["insights-trends", tenantId, String(windowDays), scopeCacheKey(scope)],
    { revalidate: 300 }
  )();
}
