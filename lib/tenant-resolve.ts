import { DEV_FALLBACK_TENANT } from "@/lib/constants";

/**
 * Pure tenant-resolutie (geen DB / geen next/headers) zodat dit ook in de
 * edge-runtime van de proxy/middleware kan draaien.
 *
 * Productie: subdomein → `fitpower.gymrebel.app` levert "fitpower".
 * Development: subdomein `fitpower.localhost` of de query-param `?tenant=fitpower`.
 */
const RESERVED_LABELS = new Set([
  "localhost",
  "gymrebel",
  "app",
  "www",
  "vercel",
  "127",
  "0",
]);

// Platform-hosts waar het eerste label NIET de tenant is (Vercel-preview/prod
// draait op `<project>.vercel.app` — het projectnaam-label is geen tenant).
// Op zulke hosts vallen we terug op ?tenant / cookie / de fallback-tenant.
const PLATFORM_HOST_SUFFIXES = [".vercel.app"];

export function resolveTenantSlug(
  host: string | null | undefined,
  paramTenant?: string | null,
  cookieTenant?: string | null
): string {
  if (host) {
    const hostname = host.split(":")[0];
    const isPlatformHost = PLATFORM_HOST_SUFFIXES.some((suffix) =>
      hostname.endsWith(suffix)
    );
    const labels = hostname.split(".");
    // Een echt subdomein heeft minstens 2 labels en het eerste is niet gereserveerd
    // (en de host is geen platform-host zoals *.vercel.app).
    if (!isPlatformHost && labels.length >= 2 && !RESERVED_LABELS.has(labels[0])) {
      return labels[0];
    }
  }
  // Expliciete ?tenant wint; daarna de actieve-tenant-cookie (sticky na login/switch).
  if (paramTenant) return paramTenant;
  if (cookieTenant) return cookieTenant;
  return DEV_FALLBACK_TENANT;
}
