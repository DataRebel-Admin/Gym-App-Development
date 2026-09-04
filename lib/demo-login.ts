import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { demoLoginEnabled, demoLoginAllowsAccount } from "@/lib/demo-login-policy";
import type { Role } from "@prisma/client";

/**
 * Demo-login: een snel-inlog-paneel op de inlogpagina met alle demo-accounts
 * (uit de seed), zodat elke rol & sportschool zonder wachtwoord of magic link
 * te proberen is — handig voor lokaal testen én voor demo's van de
 * gepubliceerde versie.
 *
 * Geactiveerd met DEMO_LOGIN="true". In **productie** is dat bewust niet genoeg:
 * daar is óók DEMO_LOGIN_ALLOW_PRODUCTION="true" vereist. Zo kan één per ongeluk
 * gezette env-var geen productie-omgeving met de authenticatie-bypass openzetten
 * — een expliciete, tweede bevestiging is nodig voor een demo van de
 * gepubliceerde versie.
 *
 * ⚠️ LET OP — dit omzeilt de authenticatie volledig. In **productie** is de
 * kring daarom extra ingeperkt door {@link demoLoginAllowsAccount}: nooit een
 * superadmin, en alleen sportscholen die expliciet in `DEMO_LOGIN_TENANTS`
 * staan. Zet het buiten een demo-omgeving gewoon helemaal uit.
 */
export type DemoAccount = {
  email: string;
  name: string;
  /** Tenant-slug, of null voor de platform-superadmin (geen tenant). */
  tenant: string | null;
  /** Korte rol-aanduiding voor de knop. */
  role: string;
  /** Waar dit account na inloggen terechtkomt (alleen ter info in de UI). */
  area: string;
};

/**
 * Rol → knop-label + bestemming, plus de sorteervolgorde binnen een sportschool
 * (eigenaar en medewerker eerst — die zijn bij een demo het interessantst).
 */
const ROLE_META: Record<Role, { label: string; area: string; order: number }> = {
  SUPERADMIN: { label: "Superadmin", area: "/admin", order: 0 },
  TENANT_ADMIN: { label: "Owner", area: "/owner", order: 1 },
  TENANT_STAFF: { label: "Medewerker", area: "/owner", order: 2 },
  TENANT_MEMBER: { label: "Lid", area: "/member", order: 3 },
};

/** Maximaal aantal accounts per sportschool in het paneel (blijft leesbaar). */
const MAX_PER_TENANT = 6;

/**
 * De demo-accounts komen **uit de database**, niet uit een hardgecodeerde lijst.
 * Reden: e-mail/naam/rol van een demo-account wordt in de app zelf aangepast
 * (of een lid wordt gedeactiveerd) en dan wees zo'n knop naar een niet-bestaand
 * account → `resolveLoginUser` gaf null → "devError". Nu volgt het paneel altijd
 * de werkelijke staat.
 *
 * E-mail is uniek *per tenant*, dus de knop stuurt e-mail **én** tenant-slug mee
 * (die zet de login-cookie waarop `resolveLoginUser` scoopt).
 *
 * Alleen accounts die ook echt kunnen inloggen: actief, niet gearchiveerd en —
 * voor tenant-gebruikers — een actieve sportschool (zelfde eisen als de
 * `signIn`-callback in auth.ts).
 */
// Herexport zodat bestaande importplekken ongewijzigd blijven werken.
export { demoLoginEnabled, demoLoginAllowsAccount };

export const listDemoAccounts = cache(async (): Promise<DemoAccount[]> => {
  if (!demoLoginEnabled()) return [];

  const users = await prisma.user.findMany({
    where: {
      active: true,
      archivedAt: null,
      OR: [
        // Platform-superadmin (geen tenant) …
        { tenantId: null, role: "SUPERADMIN" },
        // … of een gebruiker van een actieve sportschool.
        { tenant: { is: { status: "ACTIVE" } } },
      ],
    },
    select: {
      email: true,
      name: true,
      role: true,
      createdAt: true,
      tenant: { select: { slug: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const accounts = users
    .filter((u) => demoLoginAllowsAccount({ role: u.role, tenantSlug: u.tenant?.slug ?? null }))
    .map((u) => ({
    email: u.email,
    name: u.name?.trim() || u.email,
    tenant: u.tenant?.slug ?? null,
    role: ROLE_META[u.role].label,
    area: ROLE_META[u.role].area,
    // Alleen voor sortering — valt buiten DemoAccount.
    _order: ROLE_META[u.role].order,
    _createdAt: u.createdAt.getTime(),
  }));

  // Platform bovenaan, daarna per sportschool (alfabetisch op slug); binnen een
  // sportschool op rol en daarna op aanmaakmoment (= seed-volgorde).
  const groups = new Map<string, typeof accounts>();
  for (const a of accounts) {
    const key = a.tenant ?? "";
    const group = groups.get(key);
    if (group) group.push(a);
    else groups.set(key, [a]);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b)) // "" (platform) sorteert vooraan
    .flatMap(([, group]) =>
      group
        .sort((a, b) => a._order - b._order || a._createdAt - b._createdAt)
        .slice(0, MAX_PER_TENANT)
        .map(({ _order, _createdAt, ...account }) => account)
    );
});
