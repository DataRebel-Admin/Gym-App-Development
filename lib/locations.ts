import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/db";

/**
 * Vestigingen (Location) van een organisatie (Tenant). Elke tenant heeft er
 * minstens één (de migratie maakte een "Hoofdvestiging", isDefault = true).
 * Per-request gememoiseerd via React cache() — meerdere aanroepen binnen één
 * request kosten één query. Base `prisma` + expliciete tenantId (zoals
 * lib/member-stats.ts); RLS is de backstop.
 */
export type TenantLocation = {
  id: string;
  name: string;
  slug: string | null;
  city: string | null;
  timezone: string;
  isDefault: boolean;
};

/** Actieve (niet-gearchiveerde) vestigingen van de tenant, default eerst. */
export const getTenantLocations = cache(async (tenantId: string): Promise<TenantLocation[]> => {
  return prisma.location.findMany({
    where: { tenantId, archivedAt: null },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true, city: true, timezone: true, isDefault: true },
  });
});

/**
 * De default-vestiging ("Hoofdvestiging") van de tenant. Bestaat gegarandeerd
 * (migratie-invariant + server-side afgedwongen "precies één default"); een
 * ontbrekende default duidt op een datadefect en gooit bewust hard.
 */
export async function getDefaultLocationId(tenantId: string): Promise<string> {
  const locations = await getTenantLocations(tenantId);
  const def = locations.find((l) => l.isDefault) ?? locations[0];
  if (!def) throw new Error(`Tenant ${tenantId} heeft geen (actieve) vestiging`);
  return def.id;
}

/** Heeft deze organisatie meer dan één actieve vestiging? (UI: switcher/filters tonen) */
export async function isMultiLocation(tenantId: string): Promise<boolean> {
  return (await getTenantLocations(tenantId)).length > 1;
}
