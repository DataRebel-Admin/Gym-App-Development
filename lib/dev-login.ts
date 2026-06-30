import "server-only";

/**
 * Developer-login: alleen voor lokaal testen. Toont op de inlogpagina een
 * snel-inlog-paneel met alle demo-accounts (uit de seed) zodat elke rol &
 * sportschool zonder wachtwoord/magic link te testen is.
 *
 * DUBBEL beveiligd: werkt nooit in productie. Zelfs als DEV_LOGIN per ongeluk
 * op "true" staat in een productie-omgeving, blokkeert de NODE_ENV-check het.
 */
export function devLoginEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" && process.env.DEV_LOGIN === "true"
  );
}

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
 * De demo-accounts uit prisma/seed.ts. E-mail is uniek *per tenant*: sven komt
 * bewust in beide tenants voor (de tenant-slug bepaalt welk account je krijgt).
 */
export const DEMO_ACCOUNTS: DemoAccount[] = [
  { email: "admin@datarebel.nl", name: "Platform Beheer", tenant: null, role: "Superadmin", area: "/admin" },
  { email: "owner@fitpower.nl", name: "Bea Eigenaar", tenant: "fitpower", role: "Owner", area: "/owner" },
  { email: "sven@fitpower.nl", name: "Sven Sporter", tenant: "fitpower", role: "Lid", area: "/member" },
  { email: "lisa@fitpower.nl", name: "Lisa Lifter", tenant: "fitpower", role: "Lid", area: "/member" },
  { email: "tom@fitpower.nl", name: "Tom Trainer", tenant: "fitpower", role: "Lid", area: "/member" },
  { email: "owner@ironhouse.nl", name: "Ivo IJzer", tenant: "ironhouse", role: "Owner", area: "/owner" },
  { email: "sven@fitpower.nl", name: "Sven (IronHouse)", tenant: "ironhouse", role: "Lid", area: "/member" },
];
