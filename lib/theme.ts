import "server-only";
import { cookies, headers } from "next/headers";
import { PATHNAME_HEADER } from "@/lib/constants";

export type Theme = "light" | "dark";

export const THEME_COOKIE = "gymrebel-theme";
export const DEFAULT_THEME: Theme = "dark";

/** Leest het thema uit de cookie (server-side, no-flash). Default = donker. */
export async function getTheme(): Promise<Theme> {
  const c = await cookies();
  const v = c.get(THEME_COOKIE)?.value;
  return v === "light" || v === "dark" ? v : DEFAULT_THEME;
}

/** Routes die altijd in lichte modus renderen (pre-auth), ongeacht de cookie.
 *  Na inloggen pakken member/owner/admin het ingestelde thema weer op. */
function forcesLightTheme(pathname: string): boolean {
  return pathname.startsWith("/login") || pathname.startsWith("/invite");
}

/** Het effectieve thema voor de huidige request: login-/invite-routes zijn
 *  altijd licht; alle andere routes volgen de cookie (getTheme). */
export async function getResolvedTheme(): Promise<Theme> {
  const pathname = (await headers()).get(PATHNAME_HEADER) ?? "";
  if (forcesLightTheme(pathname)) return "light";
  return getTheme();
}
