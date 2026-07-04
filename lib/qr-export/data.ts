import "server-only";
import { prisma } from "@/lib/db";
import { machinePublicUrl, machineTypeLabel } from "@/lib/machine";
import type { MachineStatus, MachineType } from "@prisma/client";
import type { QrExportBranding, QrExportFilter, QrExportGroup, QrExportMachine } from "./types";

// Server-side assemblage van te exporteren machines + tenant-branding. Volledig
// tenant-gescoped (expliciete tenantId + RLS-backstop). Nummering is stabiel per
// tenant (alle machines geordend) zodat "Nr. X" tussen exports gelijk blijft.

type TenantBrandingRow = {
  name: string;
  slug: string;
  logoUrl: string | null;
  accentColor: string | null;
};

function toBranding(t: TenantBrandingRow): QrExportBranding {
  return { tenantName: t.name, logoUrl: t.logoUrl, accentColor: t.accentColor };
}

function matchesFilter(
  machine: { type: MachineType; status: MachineStatus; location: string | null },
  filter: QrExportFilter,
): boolean {
  if (filter.type && machine.type !== filter.type) return false;
  if (filter.status && machine.status !== filter.status) return false;
  if (filter.location) {
    const loc = (machine.location ?? "").toLowerCase();
    if (!loc.includes(filter.location.toLowerCase())) return false;
  }
  return true;
}

/**
 * Bouwt de export-groep voor één tenant. Numbers worden over álle machines
 * berekend; daarna passen we de selectie (ids) of overige filters toe.
 */
export async function getExportGroupForTenant(
  tenantId: string,
  filter: QrExportFilter = {},
): Promise<QrExportGroup | null> {
  const tenant = await prisma.tenant.findFirst({
    where: { id: tenantId, deletedAt: null },
    select: { name: true, slug: true, logoUrl: true, accentColor: true },
  });
  if (!tenant) return null;

  const all = await prisma.machine.findMany({
    where: { tenantId },
    orderBy: [{ createdAt: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      type: true,
      status: true,
      location: true,
      serialNumber: true,
      qrToken: true,
    },
  });

  const idSet = filter.ids && filter.ids.length > 0 ? new Set(filter.ids) : null;

  const machines: QrExportMachine[] = all
    .map((m, i) => ({ m, number: i + 1 }))
    .filter(({ m }) => {
      // Expliciete selectie heeft voorrang op de losse filters.
      if (idSet) return idSet.has(m.id);
      return matchesFilter(m, filter);
    })
    .map(({ m, number }) => ({
      id: m.id,
      name: m.name,
      number,
      serialNumber: m.serialNumber,
      location: m.location,
      category: machineTypeLabel(m.type),
      url: machinePublicUrl(tenant.slug, m.qrToken),
    }));

  return { branding: toBranding(tenant), machines };
}

/** Superadmin: groepen voor meerdere tenants (of alle actieve tenants). */
export async function getExportGroupsForTenants(
  tenantIds: string[] | "all",
  filter: QrExportFilter = {},
): Promise<QrExportGroup[]> {
  let ids: string[];
  if (tenantIds === "all") {
    const tenants = await prisma.tenant.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true },
    });
    ids = tenants.map((t) => t.id);
  } else {
    ids = tenantIds;
  }
  const groups: QrExportGroup[] = [];
  for (const id of ids) {
    // Bij "alle tenants" negeren we ids-selectie (die is tenant-specifiek).
    const groupFilter: QrExportFilter =
      tenantIds === "all" ? { ...filter, ids: undefined } : filter;
    const group = await getExportGroupForTenant(id, groupFilter);
    if (group && group.machines.length > 0) groups.push(group);
  }
  return groups;
}

/** Totaal aantal machines over alle groepen (voor audit/telling). */
export function countMachines(groups: QrExportGroup[]): number {
  return groups.reduce((sum, g) => sum + g.machines.length, 0);
}
