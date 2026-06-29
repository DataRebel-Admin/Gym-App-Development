import NextAuth from "next-auth";
import Nodemailer from "next-auth/providers/nodemailer";
import { authConfig } from "@/auth.config";
import { TenantPrismaAdapter } from "@/lib/auth-adapter";
import { prisma } from "@/lib/db";

/**
 * Volledige Auth.js-instantie (server-side, Node-runtime): met de tenant-scoped
 * Prisma-adapter en de Nodemailer (magic link) provider.
 *
 * In development wordt de magic link naar de console gelogd i.p.v. gemaild
 * (zie sendVerificationRequest). Voor productie wordt hier later een echte
 * SMTP/Resend-transport ingehangen.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: TenantPrismaAdapter(),
  providers: [
    Nodemailer({
      // Niet gebruikt in dev omdat we sendVerificationRequest overschrijven.
      server: { host: "localhost", port: 1025 },
      from: "no-reply@gymrebel.app",
      async sendVerificationRequest({ identifier, url }) {
        // Magic link in de console (development).
        console.log(
          "\n✉️  [GymRebel] Magic link voor " +
            identifier +
            ":\n" +
            url +
            "\n"
        );
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    /**
     * Tenant-handhaving: alleen e-mailadressen die als bestaande gebruiker bij
     * de actieve tenant horen mogen inloggen. `user.tenantId` is alleen gevuld
     * wanneer onze tenant-scoped getUserByEmail een echte gebruiker vond.
     */
    async signIn({ user }) {
      if (!user) return false;
      // Gedeactiveerde accounts mogen niet inloggen.
      if ("active" in user && user.active === false) return false;
      // SUPERADMIN heeft geen tenantId maar mag inloggen.
      if ("role" in user && user.role === "SUPERADMIN") return true;
      // Tenant-gebruikers: alleen met een geldige tenant-koppeling.
      if (!("tenantId" in user) || !user.tenantId) return false;
      // Tenant moet actief en niet verwijderd zijn.
      const tenant = await prisma.tenant.findUnique({
        where: { id: user.tenantId },
        select: { status: true, deletedAt: true },
      });
      if (!tenant || tenant.deletedAt || tenant.status !== "ACTIVE") return false;
      return true;
    },
  },
});
