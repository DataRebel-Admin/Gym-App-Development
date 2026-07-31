/**
 * De absolute basis-URL van de app.
 *
 * Nodig zodra een link of afbeelding de app verlaat: in een e-mail, een PDF of
 * een push-melding bestaat "/" niet. Binnen de app blijven relatieve paden
 * uiteraard prima.
 *
 * Resolutie: `APP_BASE_URL` → `AUTH_URL` → `NEXTAUTH_URL` → productie-default.
 * De crons en de meldingen-helpers gebruiken deze helper; schrijf die keten
 * nergens opnieuw uit.
 *
 * ⚠️ **`APP_BASE_URL` bestaat omdat `AUTH_URL` géén neutrale bron is.** NextAuth
 * herschrijft met `reqWithEnvURL()` de origin van élke request naar `AUTH_URL`
 * (zie next-auth/lib/env.js), dus een vaste waarde daar trekt een bezoeker op
 * `fitpower.gymrebel-training.com` bij elke middleware-redirect naar die ene
 * host — funest zodra de tenant-subdomeinen live gaan. Zet `APP_BASE_URL` op de
 * app-host en laat `AUTH_URL` leeg (`trustHost: true` in auth.config.ts leidt de
 * origin dan af uit de request), dan blijven e-mails, PDF's en QR-labels tóch
 * een absolute URL houden.
 */
const FALLBACK_BASE_URL = "https://app.gymrebel-training.com";

/** Basis-URL zonder afsluitende slash, bijv. `https://app.gymrebel-training.com`. */
export function appBaseUrl(): string {
  const raw =
    process.env.APP_BASE_URL ??
    process.env.AUTH_URL ??
    process.env.NEXTAUTH_URL ??
    FALLBACK_BASE_URL;
  return raw.trim().replace(/\/+$/, "");
}

/**
 * Maakt een pad absoluut. Een URL die al absoluut is (http/https/data) blijft
 * ongemoeid — een tenant uploadt z'n logo naar Blob en heeft dus al een volledige
 * URL; alleen onze eigen `/brand/…`-paden moeten voorvoegsel krijgen.
 */
export function toAbsoluteUrl(url: string | null | undefined): string | null {
  const value = url?.trim();
  if (!value) return null;
  if (/^(https?:|data:|mailto:|tel:)/i.test(value)) return value;
  return `${appBaseUrl()}/${value.replace(/^\/+/, "")}`;
}
