import "server-only";
import { cookies } from "next/headers";

export type Theme = "light" | "dark";

export const THEME_COOKIE = "gymrebel-theme";
export const DEFAULT_THEME: Theme = "dark";

/** Leest het thema uit de cookie (server-side, no-flash). Default = donker. */
export async function getTheme(): Promise<Theme> {
  const c = await cookies();
  const v = c.get(THEME_COOKIE)?.value;
  return v === "light" || v === "dark" ? v : DEFAULT_THEME;
}
