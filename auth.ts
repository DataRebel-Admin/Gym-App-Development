import NextAuth from "next-auth";
import Nodemailer from "next-auth/providers/nodemailer";
import { authConfig } from "@/auth.config";
import { TenantPrismaAdapter } from "@/lib/auth-adapter";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import type { Role } from "@prisma/client";

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
      const actor = {
        id: user.id ?? null,
        email: user.email ?? null,
        role: ("role" in user ? (user.role as Role) : null) ?? null,
      };
      const tenantId =
        "tenantId" in user ? ((user.tenantId as string | null) ?? null) : null;
      // Gedeactiveerde accounts mogen niet inloggen. (Bestaand account → loggen.)
      if ("active" in user && user.active === false) {
        await audit("auth.login.failed", {
          actor, tenantId, status: "FAILED", metadata: { reason: "deactivated" },
        });
        return false;
      }
      // SUPERADMIN heeft geen tenantId maar mag inloggen.
      if ("role" in user && user.role === "SUPERADMIN") return true;
      // Tenant-gebruikers: alleen met een geldige tenant-koppeling.
      // Geen tenantId = onbekend/verkeerd e-mailadres → bewust NIET loggen.
      if (!("tenantId" in user) || !user.tenantId) return false;
      // Tenant moet actief en niet verwijderd zijn.
      const tenant = await prisma.tenant.findUnique({
        where: { id: user.tenantId },
        select: { status: true, deletedAt: true },
      });
      if (!tenant || tenant.deletedAt || tenant.status !== "ACTIVE") {
        await audit("auth.login.failed", {
          actor, tenantId, status: "FAILED", metadata: { reason: "tenant_inactive" },
        });
        return false;
      }
      return true;
    },
  },
  events: {
    async signIn({ user }) {
      await audit("auth.login", {
        actor: {
          id: user.id ?? null,
          email: user.email ?? null,
          role: ("role" in user ? (user.role as Role) : null) ?? null,
        },
        tenantId:
          "tenantId" in user ? ((user.tenantId as string | null) ?? null) : null,
        targetType: "User",
        targetId: user.id ?? undefined,
      });
    },
    async signOut(message) {
      const token = "token" in message ? message.token : null;
      if (!token) return;
      await audit("auth.logout", {
        actor: {
          id: (token.id as string) ?? null,
          email: (token.email as string) ?? null,
          role: (token.role as Role) ?? null,
        },
        tenantId: (token.tenantId as string | null) ?? null,
        targetType: "User",
        targetId: (token.id as string) ?? undefined,
      });
    },
  },
});
