import "server-only";

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
 * ⚠️ LET OP — dit omzeilt de authenticatie volledig: iedereen die de
 * inlogpagina bereikt kan als élk demo-account inloggen, inclusief de
 * superadmin (volledige platformtoegang). Zet dit alleen aan op een demo-/
 * testomgeving en uit zodra er echte gebruikers of data in de omgeving staan.
 */
export function demoLoginEnabled(): boolean {
  if (process.env.DEMO_LOGIN !== "true") return false;
  if (process.env.NODE_ENV === "production") {
    return process.env.DEMO_LOGIN_ALLOW_PRODUCTION === "true";
  }
  return true;
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
 * De demo-accounts uit prisma/seed.ts. E-mail is uniek *per tenant*: duco komt
 * bewust in beide tenants voor (de tenant-slug bepaalt welk account je krijgt).
 */
export const DEMO_ACCOUNTS: DemoAccount[] = [
  { email: "admin@datarebel.nl", name: "Platform Beheer", tenant: null, role: "Superadmin", area: "/admin" },
  { email: "keimpe@gymrebel.nl", name: "Keimpe Krachtpatser", tenant: "gymrebel", role: "Owner", area: "/owner" },
  { email: "coach@gymrebel.nl", name: "Coen Coach", tenant: "gymrebel", role: "Medewerker", area: "/owner" },
  { email: "duco@gymrebel.nl", name: "Duco Dumbbell", tenant: "gymrebel", role: "Lid", area: "/member" },
  { email: "lisa@gymrebel.nl", name: "Lisa Lifter", tenant: "gymrebel", role: "Lid", area: "/member" },
  { email: "tom@gymrebel.nl", name: "Tom Trainer", tenant: "gymrebel", role: "Lid", area: "/member" },
  { email: "owner@ironhouse.nl", name: "Ivo IJzer", tenant: "ironhouse", role: "Owner", area: "/owner" },
  { email: "duco@gymrebel.nl", name: "Duco (IronHouse)", tenant: "ironhouse", role: "Lid", area: "/member" },
];
