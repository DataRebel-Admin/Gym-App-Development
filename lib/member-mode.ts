import type { Role } from "@prisma/client";

/**
 * Lid-modus: een eigenaar (`TENANT_ADMIN`) of medewerker (`TENANT_STAFF`) die
 * óók zelf bij deze sportschool sport. Eén account, twee modi.
 *
 * **Waarom geen tweede account?** `User` is uniek op `(tenantId, email)` en de
 * tenant-scoped Auth.js-adapter zoekt op (tenant, e-mail). Twee rijen met
 * hetzelfde adres in dezelfde tenant maakt "welke rij logt in?" onbeslisbaar en
 * raakt login, wachtwoord-reset, 2FA én uitnodigingen. De vlag
 * `User.trainsAsMember` geeft hetzelfde resultaat zonder die invariant te breken.
 *
 * De vlag zet **alleen de eigenaar** aan (op `/owner/staff`). Hij opent uitsluitend
 * de member-area op de eigen trainingsdata; de ledenadministratie en de analytics
 * blijven rol-gebaseerd (leden ↔ team blijven gescheiden lijsten).
 *
 * Dit bestand is **puur** (geen DB, geen auth) zodat client-componenten en tests
 * het kunnen importeren — idioom lib/rbac.ts / lib/location-scope.ts. De
 * serverkant (de vlag ophalen) staat in lib/member-mode-server.ts.
 */

/** Tenant-rollen die de beheeromgeving `/owner` gebruiken. */
export function isTeamRole(role: Role | string | undefined | null): boolean {
  return role === "TENANT_ADMIN" || role === "TENANT_STAFF";
}

/**
 * Mag deze gebruiker de member-area (`/member`) gebruiken? Een gewoon lid altijd;
 * een teamlid alleen mét de lid-modus aan. Superadmin nooit — die transcendeert
 * tenants en heeft geen trainingsdata.
 */
export function canTrainAsMember(
  role: Role | string | undefined | null,
  trainsAsMember: boolean | null | undefined
): boolean {
  if (role === "TENANT_MEMBER") return true;
  return isTeamRole(role) && trainsAsMember === true;
}

/** Heeft deze gebruiker beide werelden (en dus iets te kiezen)? */
export function hasBothModes(
  role: Role | string | undefined | null,
  trainsAsMember: boolean | null | undefined
): boolean {
  return isTeamRole(role) && trainsAsMember === true;
}

export type AppMode = "member" | "owner";

/** Cookiewaarde → modus. Onbekende waarde telt als "geen keuze". */
export function parseMode(value: string | null | undefined): AppMode | null {
  return value === "member" || value === "owner" ? value : null;
}

/**
 * Waar landt deze gebruiker bij het openen van de app?
 *
 * - Geen dubbele modus → gewoon de eigen omgeving (huidig gedrag, ongewijzigd).
 * - Dubbele modus zonder modus-cookie → `"choose"` (het keuzescherm `/start`).
 * - Dubbele modus mét cookie → die keuze.
 *
 * De cookie is een sessiecookie, dus een koude app-start levert opnieuw
 * `"choose"` op — tenzij de gebruiker "onthoud mijn keuze" koos.
 */
export function resolveOpenMode(
  role: Role | string | undefined | null,
  trainsAsMember: boolean | null | undefined,
  cookieValue: string | null | undefined
): AppMode | "choose" {
  if (!hasBothModes(role, trainsAsMember)) {
    return role === "TENANT_MEMBER" ? "member" : "owner";
  }
  return parseMode(cookieValue) ?? "choose";
}

/** Startpad per modus. */
export function modeHref(mode: AppMode): string {
  return mode === "member" ? "/member" : "/owner";
}
