import "server-only";

/**
 * Demo-login: een snel-inlog-paneel op de inlogpagina met alle demo-accounts
 * (uit de seed), zodat elke rol & sportschool zonder wachtwoord of magic link
 * te proberen is — handig voor lokaal testen én voor demo's van de
 * gepubliceerde versie.
 *
 * Geactiveerd met DEMO_LOGIN="true" (ook in productie, bewust).
 *
 * ⚠️ LET OP — dit omzeilt de authenticatie volledig: iedereen die de
 * inlogpagina bereikt kan als élk demo-account inloggen, inclusief de
 * superadmin (volledige platformtoegang). Zet dit alleen aan op een demo-/
 * testomgeving en uit zodra er echte gebruikers of data in de omgeving staan.
 */
export function demoLoginEnabled(): boolean {
  return process.env.DEMO_LOGIN === "true";
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
