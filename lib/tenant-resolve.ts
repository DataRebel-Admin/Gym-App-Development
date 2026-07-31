import { DEV_FALLBACK_TENANT } from "@/lib/constants";

/**
 * Pure tenant-resolutie (geen DB / geen next/headers) zodat dit ook in de
 * edge-runtime van de proxy/middleware kan draaien.
 *
 * Productie: subdomein → `sportschool-x.gymrebel-training.com` levert
 * "sportschool-x". Development: subdomein `sportschool-x.localhost` of de
 * query-param `?tenant=gymrebel`.
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

/**
 * Het registrable basisdomein waaronder de tenant-subdomeinen hangen. Dezelfde
 * bron als de QR-URL's (lib/machine.ts), zodat "waar draait de app" op één plek
 * staat.
 */
const ROOT_DOMAIN = (process.env.NEXT_PUBLIC_APP_DOMAIN || "gymrebel-training.com")
  .trim()
  .toLowerCase();

/**
 * Het tenant-label uit de host, of `null` als de host geen tenant aanwijst.
 *
 * ⚠️ Het **apex-domein is géén tenant.** Dat ging eerder mis: de oude regel
 * ("≥ 2 labels en het eerste is niet gereserveerd") las `gymrebel-training.com`
 * als tenant-slug "gymrebel-training", dus elke bezoeker van het kale domein
 * kreeg een niet-bestaande tenant mee. Een tenant-host heeft per definitie een
 * label méér dan het basisdomein.
 */
function tenantLabelFromHost(hostname: string, rootDomain: string): string | null {
  if (PLATFORM_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) return null;

  if (rootDomain) {
    // Het basisdomein zelf (en www.) is de marketing-/platformkant, geen tenant.
    if (hostname === rootDomain || hostname === `www.${rootDomain}`) return null;
    if (hostname.endsWith(`.${rootDomain}`)) {
      const label = hostname.slice(0, -(rootDomain.length + 1)).split(".")[0];
      return label && !RESERVED_LABELS.has(label) ? label : null;
    }
    // Valt de host buiten het basisdomein (dev op *.localhost, een preview-host,
    // een eigen domein van een sportschool), dan geldt de heuristiek hieronder.
  }

  // Een echt subdomein heeft minstens 2 labels en het eerste is niet gereserveerd.
  const labels = hostname.split(".");
  if (labels.length >= 2 && !RESERVED_LABELS.has(labels[0])) return labels[0];
  return null;
}

export function resolveTenantSlug(
  host: string | null | undefined,
  paramTenant?: string | null,
  cookieTenant?: string | null,
  rootDomain: string = ROOT_DOMAIN
): string {
  if (host) {
    const hostname = host.split(":")[0].toLowerCase();
    const label = tenantLabelFromHost(hostname, rootDomain);
    if (label) return label;
  }
  // Expliciete ?tenant wint; daarna de actieve-tenant-cookie (sticky na login/switch).
  if (paramTenant) return paramTenant;
  if (cookieTenant) return cookieTenant;
  return DEV_FALLBACK_TENANT;
}
