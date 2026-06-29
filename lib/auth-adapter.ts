import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter, AdapterUser } from "next-auth/adapters";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { AUTH_TENANT_COOKIE } from "@/lib/constants";

/**
 * Tenant-scoped Auth.js-adapter.
 *
 * De standaard Prisma-adapter gaat uit van een globaal uniek e-mailadres.
 * Bij GymRebel is e-mail uniek *per tenant* (`@@unique([tenantId, email])`),
 * zodat dezelfde persoon lid kan zijn van meerdere sportscholen. We overschrijven
 * daarom `getUserByEmail` zodat die de actieve tenant (uit de login-cookie) meeneemt.
 *
 * Onbekende e-mailadressen worden geweigerd in de `signIn`-callback (zie auth.ts):
 * leden worden door de owner aangemaakt, niet automatisch bij het inloggen.
 */
async function currentTenantId(): Promise<string | null> {
  const store = await cookies();
  const slug = store.get(AUTH_TENANT_COOKIE)?.value;
  if (!slug) return null;
  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  return tenant?.id ?? null;
}

export function TenantPrismaAdapter(): Adapter {
  const base = PrismaAdapter(prisma);

  return {
    ...base,

    async getUserByEmail(email): Promise<AdapterUser | null> {
      const tenantId = await currentTenantId();
      if (!tenantId) return null;

      const user = await prisma.user.findUnique({
        where: { tenantId_email: { tenantId, email } },
      });
      return (user as AdapterUser | null) ?? null;
    },

    async createUser(): Promise<AdapterUser> {
      // Invite-only: er wordt nooit automatisch een account aangemaakt bij login.
      // (De signIn-callback weigert onbekende e-mailadressen al vóór dit punt.)
      throw new Error(
        "Geen account gevonden voor dit e-mailadres in deze sportschool."
      );
    },
  };
}
