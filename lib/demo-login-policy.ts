/**
 * Wie mag er wachtwoordloos inloggen met demo-login?
 *
 * Bewust **puur** (géén `server-only`, geen database): zowel de knoppenlijst
 * (`lib/demo-login.ts`) als de authenticatiepoort (`authorize` in auth.ts)
 * gebruikt dezelfde regel, en hij is zo direct te testen. Idioom van
 * `lib/push-channels.ts` en `lib/notification-defaults.ts`.
 *
 * ⚠️ Demo-login omzeilt de authenticatie volledig. Zet het buiten een
 * demo-omgeving gewoon helemaal uit; de beperkingen hieronder zijn een vangnet,
 * geen vervanging daarvan.
 */

import type { Role } from "@prisma/client";

/**
 * Staat demo-login aan?
 *
 * `DEMO_LOGIN="true"` volstaat buiten productie. In **productie** is óók
 * `DEMO_LOGIN_ALLOW_PRODUCTION="true"` vereist, zodat één per ongeluk gezette
 * variabele geen productieomgeving openzet.
 */
export function demoLoginEnabled(): boolean {
  if (process.env.DEMO_LOGIN !== "true") return false;
  if (process.env.NODE_ENV === "production") {
    return process.env.DEMO_LOGIN_ALLOW_PRODUCTION === "true";
  }
  return true;
}

/**
 * Sportschool-slugs waarvoor demo-login in productie is toegestaan
 * (`DEMO_LOGIN_TENANTS="gymrebel,ironhouse"`). Leeg = niemand: fail-closed.
 */
function demoTenantAllowlist(): Set<string> {
  return new Set(
    (process.env.DEMO_LOGIN_TENANTS ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

/**
 * Mag er met dit account wachtwoordloos ingelogd worden?
 *
 * **Dit is de poort, niet de knoppenlijst.** `demoSignIn` en de
 * `demo-login`-provider lezen het e-mailadres uit het formulier, dus wie alleen
 * het paneel zou filteren houdt de bypass over: een handmatige POST met het
 * superadmin-adres kwam er nog steeds doorheen.
 *
 * In productie gelden twee beperkingen boven op de dubbele env-schakelaar:
 * - **nooit een SUPERADMIN** — dat account ziet elke sportschool, het auditlog,
 *   de e-mailtemplates en de meldingen-inbox;
 * - **alleen sportscholen uit `DEMO_LOGIN_TENANTS`** — de lijst met accounts
 *   komt uit de database en niet uit de seed, dus zonder allowlist schuift elke
 *   nieuw aangesloten, échte sportschool vanzelf het publieke paneel in.
 *
 * Buiten productie verandert er niets: daar is juist elke rol nodig.
 */
export function demoLoginAllowsAccount(account: {
  role: Role;
  tenantSlug: string | null;
}): boolean {
  if (!demoLoginEnabled()) return false;
  if (process.env.NODE_ENV !== "production") return true;
  if (account.role === "SUPERADMIN" || !account.tenantSlug) return false;
  return demoTenantAllowlist().has(account.tenantSlug.toLowerCase());
}
