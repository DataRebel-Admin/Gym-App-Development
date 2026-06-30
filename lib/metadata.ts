import "server-only";
import type { Metadata } from "next";
import { getCurrentTenant } from "@/lib/tenant";

/**
 * Centrale paginatitel- en favicon-logica.
 *
 * Eén bron van waarheid voor de browsertitel: de root-layout zet via
 * {@link rootMetadata} een `title.template` (`%s | <tenant> · GymRebel`), zodat
 * elke pagina alleen een kort, beschrijvend titel-segment hoeft te zetten
 * (`export const metadata = { title: "Leden" }` of een `generateMetadata`).
 * Next.js wikkelt dat automatisch in het sjabloon → "Leden | FitPower · GymRebel".
 *
 * Whitelabel: de suffix volgt de tenantnaam (geen hardcoded branding); zonder
 * tenant valt het terug op alleen de platformnaam.
 */

/** Platformnaam, altijd als laatste in de titel. */
export const APP_NAME = "GymRebel";

/** Bouwt de suffix achter elke paginatitel: "<tenant> · GymRebel" of "GymRebel". */
export function titleSuffix(tenantName: string | null | undefined): string {
  return tenantName ? `${tenantName} · ${APP_NAME}` : APP_NAME;
}

/**
 * Root-metadata: titel-sjabloon + dynamische favicon. Wordt als
 * `generateMetadata` vanuit `app/layout.tsx` gebruikt zodat de titel en favicon
 * per request (per tenant) kloppen — ook bij navigeren, verversen en in de
 * browsergeschiedenis.
 */
export async function rootMetadata(): Promise<Metadata> {
  const tenant = await getCurrentTenant();
  const suffix = titleSuffix(tenant?.name);

  // Bonus: gebruik het tenant-favicon, anders het logo als favicon, anders niets
  // (Next valt dan terug op het bestand `app/favicon.ico`).
  const icon = tenant?.faviconUrl ?? tenant?.logoUrl ?? undefined;

  return {
    title: {
      template: `%s | ${suffix}`,
      default: suffix,
    },
    description: "Slimmer trainen in jouw sportschool.",
    ...(icon ? { icons: { icon } } : {}),
  };
}
