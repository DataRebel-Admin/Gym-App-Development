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

export function resolveTenantSlug(
  host: string | null | undefined,
  paramTenant?: string | null
): string {
  if (host) {
    const hostname = host.split(":")[0];
    const labels = hostname.split(".");
    // Een echt subdomein heeft minstens 2 labels en het eerste is niet gereserveerd.
    if (labels.length >= 2 && !RESERVED_LABELS.has(labels[0])) {
      return labels[0];
    }
  }
  if (paramTenant) return paramTenant;
  return DEV_FALLBACK_TENANT;
}
