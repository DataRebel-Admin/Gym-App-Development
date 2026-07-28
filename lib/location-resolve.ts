import "server-only";
import { cookies } from "next/headers";
import { LOCATION_COOKIE, TENANT_COOKIE_MAX_AGE } from "@/lib/constants";
import { getTenantLocations, getDefaultLocationId } from "@/lib/locations";

/**
 * Sessie-locatie-resolutie (D8 in het vestigingen-ontwerp) — hét ene pad dat
 * bepaalt op welke vestiging een activiteit wordt geregistreerd:
 *
 *   expliciete keuze (gevalideerde request-param)
 *   → device-cookie `gymrebel-location` (per apparaat onthouden)
 *   → User.homeLocationId (thuisvestiging)
 *   → default-vestiging van de tenant.
 *
 * Elke kandidaat wordt gevalideerd tegen de ACTIEVE vestigingen van de tenant —
 * een gearchiveerde, vreemde of verlopen waarde valt stil door naar de volgende
 * trap. Single-location-organisaties komen altijd op hun enige vestiging uit
 * (en zien dus nooit een switcher).
 */
export async function resolveActiveLocationId(
  tenantId: string,
  opts: { requestedLocationId?: string | null; homeLocationId?: string | null } = {}
): Promise<string> {
  const locations = await getTenantLocations(tenantId);
  const valid = new Set(locations.map((l) => l.id));

  if (opts.requestedLocationId && valid.has(opts.requestedLocationId)) {
    return opts.requestedLocationId;
  }

  try {
    const jar = await cookies();
    const fromCookie = jar.get(LOCATION_COOKIE)?.value;
    if (fromCookie && valid.has(fromCookie)) return fromCookie;
  } catch {
    // Buiten request-scope (bv. cron) — geen cookie beschikbaar.
  }

  if (opts.homeLocationId && valid.has(opts.homeLocationId)) return opts.homeLocationId;

  return getDefaultLocationId(tenantId);
}

/** Onthoud de gekozen vestiging op dit apparaat (aan te roepen vanuit een server action). */
export async function setActiveLocationCookie(locationId: string): Promise<void> {
  const jar = await cookies();
  jar.set(LOCATION_COOKIE, locationId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: TENANT_COOKIE_MAX_AGE,
  });
}
