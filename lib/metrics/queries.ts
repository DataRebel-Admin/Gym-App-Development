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
import {
  activeMemberCounts,
  visitsPerLocation,
  occupancyByHour,
  retentionRate,
  noShowStatsPerLocation,
  monthKeyInTz,
  type OccupancyCell,
  type VisitRow,
} from "@/lib/metrics/definitions";

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
  scope: LocationScope
): Promise<LocationComparison> {
  const windowDays = 30;
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
  scope: LocationScope
): Promise<LocationComparison> {
  // Scope verplicht in de keyParts (voorkomt scope-lek via de gedeelde cache).
  return unstable_cache(
    () => computeLocationComparison(tenantId, scope),
    ["location-comparison", tenantId, scopeCacheKey(scope)],
    { revalidate: 300 }
  )();
}
