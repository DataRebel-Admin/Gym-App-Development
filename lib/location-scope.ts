// Pure locatie-scope-logica (geen Prisma-runtime/server-only — idioom
// lib/trainer-scope.ts): bepaalt wélke vestigingen een gebruiker mag zien en
// levert de bijbehorende Prisma-`where`-fragmenten. Los testbaar in
// tests/location-scope.test.ts.
//
// Semantiek (bewust anders dan de coach-koppeling, die een additieve "lens" is):
// de StaffLocationAccess-koppeling is een RESTRICTIE en faalt gesloten —
// een medewerker zonder koppelingen ziet níéts. TENANT_ADMIN/SUPERADMIN hebben
// impliciet de hele organisatie (`kind: "org"`); alleen die scope mag naar het
// geconsolideerde organisatie-totaal rollen (`canRollUp`).
import type { Role } from "@prisma/client";
import { ForbiddenError } from "./rbac";

export type LocationScope =
  | { kind: "org" }
  | { kind: "locations"; ids: string[] };

/**
 * De vestigingen die deze gebruiker mag zien. Admin/superadmin → hele
 * organisatie; medewerker → uitsluitend de gekoppelde vestigingen (gesnoeid op
 * de actieve vestigingen van de tenant — een koppeling naar een gearchiveerde of
 * vreemde vestiging telt niet); overige rollen → niets.
 */
export function accessibleLocations(
  user: { role: Role },
  allLocationIds: string[],
  links: { locationId: string }[]
): LocationScope {
  if (user.role === "SUPERADMIN" || user.role === "TENANT_ADMIN") return { kind: "org" };
  if (user.role !== "TENANT_STAFF") return { kind: "locations", ids: [] };
  const all = new Set(allLocationIds);
  const ids = [...new Set(links.map((l) => l.locationId))].filter((id) => all.has(id));
  return { kind: "locations", ids };
}

/**
 * Prisma-`where`-fragment voor tabellen mét een eigen `locationId`-kolom
 * (WorkoutSession/ClassSession/Machine/MachineScan/MaintenanceRecord).
 * Draagt ALTIJD `tenantId` (organisatie-isolatie is nooit optioneel); een lege
 * scope levert `locationId: { in: [] }` → matcht niets (fail-closed).
 */
export function locationScopeWhere(
  tenantId: string,
  scope: LocationScope
): { tenantId: string; locationId?: { in: string[] } } {
  if (scope.kind === "org") return { tenantId };
  return { tenantId, locationId: { in: scope.ids } };
}

/**
 * Variant voor tabellen die hun vestiging via de sessie erven
 * (PerformanceEntry, en les-aanmeldingen via ClassSession: geef dan
 * `relation: "session"` resp. de relatienaam mee als sleutel in de caller).
 */
export function sessionLocationWhere(
  tenantId: string,
  scope: LocationScope
): { tenantId: string; session?: { locationId: { in: string[] } } } {
  if (scope.kind === "org") return { tenantId };
  return { tenantId, session: { locationId: { in: scope.ids } } };
}

/** Mag deze scope het geconsolideerde organisatie-totaal zien? */
export function canRollUp(scope: LocationScope): boolean {
  return scope.kind === "org";
}

/** Valt deze vestiging binnen de scope? */
export function canAccessLocation(scope: LocationScope, locationId: string): boolean {
  return scope.kind === "org" || scope.ids.includes(locationId);
}

/**
 * Dwingt vestiging-toegang af (naast `assertTenantAccess` in lib/rbac.ts —
 * hier gedefinieerd omdat dit bestand al van rbac importeert, nooit andersom).
 */
export function assertLocationAccess(scope: LocationScope, locationId: string): void {
  if (!canAccessLocation(scope, locationId)) throw new ForbiddenError();
}

/** De concrete vestiging-ids waarover deze scope itereert (org → alle). */
export function scopeLocationIds(scope: LocationScope, allLocationIds: string[]): string[] {
  return scope.kind === "org" ? allLocationIds : scope.ids;
}

/**
 * Verplicht cache-key-onderdeel voor élke `unstable_cache` met een scope-
 * parameter. Zónder dit deelt een vestigingsmanager de cache met de eigenaar en
 * lekt er tot 300s lang verkeerd-gescopede data (er bestaan geen
 * revalidateTag-call-sites om zoiets te purgen). Gesorteerd → stabiel voor
 * dezelfde set vestigingen.
 */
export function scopeCacheKey(scope: LocationScope): string {
  return scope.kind === "org" ? "org" : `loc:${[...scope.ids].sort().join(",")}`;
}
