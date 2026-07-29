import "server-only";
import { prisma } from "@/lib/db";
import {
  locationScopeWhere,
  type LocationScope,
} from "@/lib/location-scope";
import { OPEN_DEFECT_STATUSES } from "@/lib/defects";
import type { DefectSeverity, DefectStatus, Prisma } from "@prisma/client";

/**
 * Server-querylaag voor apparaatdefecten. Elke query draagt ALTIJD `tenantId`
 * (+ vestiging-scope voor staff via `locationScopeWhere`, fail-closed).
 * Cross-tenant/-locatie levert bewust géén resultaat op → de caller toont een
 * 404 (`notFound()`), nooit een 403 — een melding van een andere vestiging
 * "bestaat niet" (spec-eis).
 */

const openStatuses = [...OPEN_DEFECT_STATUSES];

/**
 * Selectie voor het dashboard. Bevat photoKeys voor server-side gebruik —
 * serialiseer naar de client ALTIJD alleen het aantal (de URLs blijven
 * server-side; foto's gaan via de beschermde route).
 */
const defectListSelect = {
  id: true,
  machineId: true,
  machineLabel: true,
  locationId: true,
  status: true,
  severity: true,
  symptom: true,
  description: true,
  photoKeys: true,
  reportedById: true,
  assignedToId: true,
  duplicateOfId: true,
  internalNote: true,
  resolutionNote: true,
  acknowledgedAt: true,
  createdAt: true,
  resolvedAt: true,
  machine: { select: { id: true, name: true, type: true, status: true } },
  location: { select: { id: true, name: true } },
  reportedBy: { select: { id: true, name: true, email: true } },
  assignedTo: { select: { id: true, name: true } },
  _count: { select: { confirmations: true } },
} satisfies Prisma.EquipmentDefectSelect;

export type DefectListRow = Prisma.EquipmentDefectGetPayload<{
  select: typeof defectListSelect;
}>;

/**
 * Eén melding binnen tenant + scope (of null → caller doet notFound()).
 * `scope` weglaten = alleen tenant-isolatie (bv. voor member-acties op de
 * eigen melding).
 */
export async function getScopedDefect(
  id: string,
  tenantId: string,
  scope?: LocationScope
) {
  return prisma.equipmentDefect.findFirst({
    where: { id, ...(scope ? locationScopeWhere(tenantId, scope) : { tenantId }) },
    select: {
      ...defectListSelect,
      photoKeys: true,
      internalNote: true,
      resolutionNote: true,
      acknowledgedAt: true,
      updatedAt: true,
      resolvedBy: { select: { id: true, name: true } },
      confirmations: {
        select: { userId: true, createdAt: true },
        orderBy: { createdAt: "asc" as const },
      },
    },
  });
}

/**
 * Open meldingen voor een apparaat (duplicaatcheck in de meldstroom + de
 * meldhistorie op het detail). Lid-veilig: geen melder-identiteit, geen
 * interne velden, geen foto-keys.
 */
export async function getOpenDefectsForMachineQuery(tenantId: string, machineId: string) {
  return prisma.equipmentDefect.findMany({
    where: { tenantId, machineId, status: { in: openStatuses } },
    select: {
      id: true,
      symptom: true,
      severity: true,
      status: true,
      createdAt: true,
      _count: { select: { confirmations: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
}

export type DefectListFilters = {
  status?: DefectStatus | "open";
  severity?: DefectSeverity;
  machineId?: string;
  locationId?: string;
  /** Alleen meldingen van apparaten die buiten gebruik staan. */
  outOfServiceOnly?: boolean;
  /** Meldingen sinds deze datum. */
  since?: Date;
};

/** Dashboard-lijst: gescoped + gefilterd, gesorteerd op severity → leeftijd. */
export async function listDefects(
  tenantId: string,
  scope: LocationScope,
  filters: DefectListFilters = {}
): Promise<DefectListRow[]> {
  const where: Prisma.EquipmentDefectWhereInput = {
    ...locationScopeWhere(tenantId, scope),
    ...(filters.status === "open"
      ? { status: { in: openStatuses } }
      : filters.status
        ? { status: filters.status }
        : {}),
    ...(filters.severity ? { severity: filters.severity } : {}),
    ...(filters.machineId ? { machineId: filters.machineId } : {}),
    ...(filters.since ? { createdAt: { gte: filters.since } } : {}),
    ...(filters.outOfServiceOnly ? { machine: { status: "OUT_OF_SERVICE" } } : {}),
  };
  // Vestigingsfilter bínnen de scope (admin kiest een tab): alleen toepassen
  // als de vestiging in de scope valt — anders matcht de query niets.
  if (filters.locationId) {
    if (scope.kind === "locations" && !scope.ids.includes(filters.locationId)) {
      return [];
    }
    where.locationId = filters.locationId;
  }

  const rows = await prisma.equipmentDefect.findMany({
    where,
    select: defectListSelect,
    orderBy: { createdAt: "asc" },
  });
  // Severity aflopend (UNSAFE eerst), daarbinnen oudste eerst.
  const rank: Record<DefectSeverity, number> = { UNSAFE: 2, MAJOR: 1, MINOR: 0 };
  return rows.sort(
    (a, b) => rank[b.severity] - rank[a.severity] || a.createdAt.getTime() - b.createdAt.getTime()
  );
}

/** "Vaakst gemeld" per apparaat over de laatste `days` dagen (vervangingsvraag). */
export async function mostReportedMachines(
  tenantId: string,
  scope: LocationScope,
  days = 90,
  take = 5
): Promise<{ machineId: string; name: string; count: number }[]> {
  const since = new Date(Date.now() - days * 86_400_000);
  const grouped = await prisma.equipmentDefect.groupBy({
    by: ["machineId"],
    where: {
      ...locationScopeWhere(tenantId, scope),
      machineId: { not: null },
      createdAt: { gte: since },
    },
    _count: { _all: true },
    orderBy: { _count: { machineId: "desc" } },
    take,
  });
  const ids = grouped.map((g) => g.machineId).filter((id): id is string => Boolean(id));
  if (ids.length === 0) return [];
  const machines = await prisma.machine.findMany({
    where: { tenantId, id: { in: ids } },
    select: { id: true, name: true },
  });
  const names = new Map(machines.map((m) => [m.id, m.name]));
  return grouped
    .filter((g): g is typeof g & { machineId: string } => Boolean(g.machineId))
    .map((g) => ({
      machineId: g.machineId,
      name: names.get(g.machineId) ?? "Verwijderd apparaat",
      count: g._count._all,
    }));
}

/**
 * Waarschuwingsniveau per apparaat uit de open meldingen: UNSAFE wint van
 * MAJOR; MINOR levert geen label. Voor badges op plekken waar het apparaat al
 * getoond wordt (QR-pagina, machinelijst).
 */
export async function machineWarningMap(
  tenantId: string,
  machineIds: string[]
): Promise<Map<string, "UNSAFE" | "MAJOR">> {
  const out = new Map<string, "UNSAFE" | "MAJOR">();
  if (machineIds.length === 0) return out;
  const rows = await prisma.equipmentDefect.findMany({
    where: {
      tenantId,
      machineId: { in: machineIds },
      status: { in: openStatuses },
      severity: { in: ["MAJOR", "UNSAFE"] },
    },
    select: { machineId: true, severity: true },
  });
  for (const row of rows) {
    if (!row.machineId) continue;
    const current = out.get(row.machineId);
    if (row.severity === "UNSAFE" || !current) {
      out.set(row.machineId, row.severity === "UNSAFE" ? "UNSAFE" : "MAJOR");
    }
  }
  return out;
}

/** Heeft dit apparaat (naast `excludeDefectId`) nog een open UNSAFE-melding? */
export async function hasOtherOpenUnsafe(
  tenantId: string,
  machineId: string,
  excludeDefectId: string
): Promise<boolean> {
  const other = await prisma.equipmentDefect.findFirst({
    where: {
      tenantId,
      machineId,
      severity: "UNSAFE",
      status: { in: openStatuses },
      id: { not: excludeDefectId },
    },
    select: { id: true },
  });
  return Boolean(other);
}
