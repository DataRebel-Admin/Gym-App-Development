import NextAuth from "next-auth";
import Nodemailer from "next-auth/providers/nodemailer";
import { authConfig } from "@/auth.config";
import { TenantPrismaAdapter } from "@/lib/auth-adapter";

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
    signIn({ user }) {
      if (!user || !("tenantId" in user) || !user.tenantId) {
        return false;
      }
      return true;
    },
  },
});
