import "server-only";
import { cookies } from "next/headers";
import { BG_PARALLAX_COOKIE } from "@/lib/constants";

/**
 * Voorkeur: reageert de aurora-achtergrond op de cursor (muis-parallax)?
 *
 * Bewust cookie-gebaseerd (zoals `lib/theme.ts`) en niet via `User.preferences`:
 * de achtergrond hangt in de root-layout — óók op login en de publieke QR-pagina —
 * dus een DB-lees per request zou de hele app raken voor iets puur decoratiefs.
 * Bovendien is parallax apparaat-gebonden (alleen desktop mét muis), dus een
 * per-apparaat-voorkeur is hier ook inhoudelijk de juiste keuze.
 */
export const DEFAULT_BG_PARALLAX = true;

/** Leest de parallax-voorkeur uit de cookie (server-side, no-flash). Default aan. */
export async function getBackgroundParallax(): Promise<boolean> {
  const v = (await cookies()).get(BG_PARALLAX_COOKIE)?.value;
  return v === "off" ? false : v === "on" ? true : DEFAULT_BG_PARALLAX;
}
