// Pure trofee-scope-logica — bepaalt over wélke activiteitenset een achievement
// telt. Bewust een zelfstandig bestand zónder imports uit definitions.ts (dat
// icon-componenten importeert) zodat dit via tsx los testbaar is
// (tests/achievement-scope.test.ts) — idioom lib/trainer-scope.ts.
//
// Scopes:
// - ORGANIZATION (default): telt de volledige historie van het lid binnen de
//   organisatie; eenmalig per lidmaatschap behaalbaar (locationScopeKey "").
// - LOCATION: telt uitsluitend activiteit op één vestiging; per vestiging
//   behaalbaar (locationScopeKey = locationId) — "Thuisbasis"-achtige trofeeën.
// - GLOBAL: platform-gedefinieerde, locatie-onafhankelijke trofeeën; telt als
//   ORGANIZATION. Cross-organisatie-identiteit bestaat bewust níét (een lid =
//   één User-rij per organisatie; de e-mail-match in lib/tenants.ts is
//   uitsluitend voor de gym-switcher) — GLOBAL betekent dus "overal in de app
//   hetzelfde gedefinieerd en locatie-agnostisch", nooit "telt over meerdere
//   organisaties heen".

export type AchievementScope = "LOCATION" | "ORGANIZATION" | "GLOBAL";

export type ScopedActivity = { tenantId: string; locationId: string };

/**
 * De activiteitenset waarover een achievement met deze scope telt. Filtert
 * ALTIJD eerst op de organisatie (rijen van een andere tenant tellen nooit mee);
 * LOCATION beperkt daarna tot de opgegeven vestiging.
 */
export function activitiesForScope<T extends ScopedActivity>(
  scope: AchievementScope,
  tenantId: string,
  activities: readonly T[],
  locationId?: string
): T[] {
  const own = activities.filter((a) => a.tenantId === tenantId);
  if (scope !== "LOCATION") return own;
  if (!locationId) return [];
  return own.filter((a) => a.locationId === locationId);
}

/**
 * De `locationScopeKey` voor een toekenning: "" voor ORGANIZATION/GLOBAL
 * (eenmalig per lidmaatschap), de vestiging-id voor LOCATION (eenmalig per
 * vestiging). Onderdeel van de unieke sleutel op EarnedAchievement — houdt
 * `createMany({ skipDuplicates })` idempotent per scope-eenheid.
 */
export function locationScopeKeyFor(scope: AchievementScope, locationId?: string): string {
  return scope === "LOCATION" ? locationId ?? "" : "";
}
