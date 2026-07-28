import "server-only";
import { cache } from "react";
import { forbidden } from "next/navigation";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getTenantLocations } from "@/lib/locations";
import {
  accessibleLocations,
  canAccessLocation,
  type LocationScope,
} from "@/lib/location-scope";

/**
 * Server-laag rond de pure locatie-scope (lib/location-scope.ts): laadt de
 * actieve vestigingen + StaffLocationAccess-koppelingen en delegeert aan de
 * pure kern. Per-request gememoiseerd (patroon requireTenantUser). Deny-by-
 * default: een medewerker zonder koppelingen krijgt een lege scope.
 */
export const getLocationScope = cache(
  async (user: { id: string; role: Role; tenantId: string }): Promise<LocationScope> => {
    // Admin/superadmin: org-scope zonder extra queries.
    if (user.role === "SUPERADMIN" || user.role === "TENANT_ADMIN") {
      return accessibleLocations(user, [], []);
    }
    const [locations, links] = await Promise.all([
      getTenantLocations(user.tenantId),
      prisma.staffLocationAccess.findMany({
        where: { tenantId: user.tenantId, userId: user.id },
        select: { locationId: true },
      }),
    ]);
    return accessibleLocations(
      user,
      locations.map((l) => l.id),
      links
    );
  }
);

/**
 * Dwingt af dat de gebruiker deze vestiging mag zien/beheren (premium 403 bij
 * weigering). Gebruik op elke vestiging-geparametriseerde pagina/action.
 */
export async function requireLocationAccess(
  user: { id: string; role: Role; tenantId: string },
  locationId: string
): Promise<LocationScope> {
  const scope = await getLocationScope(user);
  if (!canAccessLocation(scope, locationId)) forbidden();
  return scope;
}
