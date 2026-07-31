/**
 * De absolute basis-URL van de app.
 *
 * Nodig zodra een link of afbeelding de app verlaat: in een e-mail, een PDF of
 * een push-melding bestaat "/" niet. Binnen de app blijven relatieve paden
 * uiteraard prima.
 *
 * Resolutie: `AUTH_URL` → `NEXTAUTH_URL` → productie-default. Dat is precies de
 * keten die de crons en de meldingen-helpers al gebruiken; deze helper is de
 * gedeelde versie ervan.
 */
const FALLBACK_BASE_URL = "https://app.gymrebel.app";

/** Basis-URL zonder afsluitende slash, bijv. `https://app.gymrebel.app`. */
export function appBaseUrl(): string {
  const raw = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? FALLBACK_BASE_URL;
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
