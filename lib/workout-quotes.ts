// Workout Quotes — korte motiverende quotes na een afgeronde training. Per
// sportschool aan/uit (Tenant.quotesEnabled) en aan te vullen met eigen quotes
// (Tenant.customQuotes). Per lid uit te zetten (User.preferences.hideQuotes).
//
// Bewust GEEN `server-only` (client-afrondscherm). Pure code + JSON-parsing.

import { pickBySeed } from "@/lib/seed-pick";

export const DEFAULT_QUOTES: readonly string[] = [
  "Consistentie wint altijd van perfectie.",
  "Iedere training brengt je dichter bij je doel.",
  "Kleine stappen zorgen voor grote resultaten.",
  "Je sterkste training begint met verschijnen.",
  "Discipline verslaat motivatie.",
  "Rust, herstel en herhaal.",
  "Vandaag beter dan gisteren.",
];

/** Parse Tenant.customQuotes (Json) → een schone lijst niet-lege strings. */
export function parseCustomQuotes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter(Boolean)
    .slice(0, 50);
}

/** Standaard-quotes + de eigen quotes van de sportschool (in die volgorde). */
export function resolveQuotes(customQuotes: unknown): string[] {
  return [...DEFAULT_QUOTES, ...parseCustomQuotes(customQuotes)];
}

/** Kies deterministisch één quote (seed = bv. sessionId). Null bij lege lijst. */
export function pickQuote(quotes: readonly string[], seed: string): string | null {
  return pickBySeed(quotes, seed);
}
