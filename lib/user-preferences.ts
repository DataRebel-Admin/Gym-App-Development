// Getypeerde toegang tot `User.preferences` (Json-kolom). Eén plek zodat de
// voorheen op meerdere sites gedupliceerde ad-hoc parsing (schema-builder,
// afrondscherm, account-instellingen) consistent en veilig blijft.
//
// Bewust GEEN `server-only`: gebruikt in server-actions én client-componenten
// (net als lib/exercise-types.ts / lib/training-goals.ts). Puur, geen DB-toegang.

import type { Prisma } from "@prisma/client";

/** Bekende voorkeuren; het onderliggende record blijft uitbreidbaar. */
export type UserPreferences = {
  favoriteExerciseIds: string[];
  /** true = motiverende Workout Quotes op het afrondscherm verbergen. */
  hideQuotes: boolean;
  /** true = trofeeën/mijlpalen verbergen in dashboard en navigatie. */
  hideAchievements: boolean;
  /** true = de trainer mag de voortgangsfoto's van dit lid bekijken. Default
   *  false (privacy-first): zonder expliciete toestemming ziet alleen het lid ze. */
  allowTrainerPhotos: boolean;
  /** true = rust-/set-timers standaard uitzetten in nieuwe trainingen. Een
   *  actieve sessie kan dit tijdelijk overschrijven (per-sessie, in localStorage). */
  disableSetTimers: boolean;
  /** Overige (nog niet getypeerde) voorkeuren blijven behouden bij schrijven. */
  [key: string]: unknown;
};

/** Ruwe `preferences`-Json → een veilig object (nooit array/null). */
export function parsePreferences(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Favoriete oefening-IDs uit de voorkeuren (gevalideerd tot strings). */
export function getFavoriteIds(value: unknown): string[] {
  const prefs = parsePreferences(value);
  const f = prefs.favoriteExerciseIds;
  return Array.isArray(f) ? f.filter((x): x is string => typeof x === "string") : [];
}

/** Of het lid de Workout Quotes heeft uitgezet (default: tonen). */
export function getHideQuotes(value: unknown): boolean {
  return parsePreferences(value).hideQuotes === true;
}

/** Of het lid de trofeeën/mijlpalen heeft verborgen (default: tonen). */
export function getHideAchievements(value: unknown): boolean {
  return parsePreferences(value).hideAchievements === true;
}

/** Mag de trainer de voortgangsfoto's van dit lid bekijken? Default false. */
export function getAllowTrainerPhotos(value: unknown): boolean {
  return parsePreferences(value).allowTrainerPhotos === true;
}

/** Of het lid rust-/set-timers standaard heeft uitgezet (default: aan). */
export function getDisableSetTimers(value: unknown): boolean {
  return parsePreferences(value).disableSetTimers === true;
}

// De writers leveren een Prisma-JSON-object voor de `preferences`-kolom. De
// bestaande waarden komen uit een DB-JSON-kolom (dus JSON-veilig); de cast op de
// DB-grens is hier gerechtvaardigd.

/** Nieuw voorkeuren-object met bijgewerkte favorieten (behoudt overige velden). */
export function withFavoriteIds(value: unknown, ids: string[]): Prisma.InputJsonObject {
  const clean = [...new Set(ids.map(String).filter(Boolean))].slice(0, 100);
  return { ...parsePreferences(value), favoriteExerciseIds: clean } as Prisma.InputJsonObject;
}

/** Nieuw voorkeuren-object met de quote-voorkeur (behoudt overige velden). */
export function withHideQuotes(value: unknown, hide: boolean): Prisma.InputJsonObject {
  return { ...parsePreferences(value), hideQuotes: hide } as Prisma.InputJsonObject;
}

/** Nieuw voorkeuren-object met de trofeeën-voorkeur (behoudt overige velden). */
export function withHideAchievements(value: unknown, hide: boolean): Prisma.InputJsonObject {
  return { ...parsePreferences(value), hideAchievements: hide } as Prisma.InputJsonObject;
}

/** Nieuw voorkeuren-object met de foto-privacy-voorkeur (behoudt overige velden). */
export function withAllowTrainerPhotos(value: unknown, allow: boolean): Prisma.InputJsonObject {
  return { ...parsePreferences(value), allowTrainerPhotos: allow } as Prisma.InputJsonObject;
}

/** Nieuw voorkeuren-object met de timer-voorkeur (behoudt overige velden). */
export function withDisableSetTimers(value: unknown, disable: boolean): Prisma.InputJsonObject {
  return { ...parsePreferences(value), disableSetTimers: disable } as Prisma.InputJsonObject;
}
