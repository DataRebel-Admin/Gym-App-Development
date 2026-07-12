import NextAuth, { type NextAuthConfig } from "next-auth";
import Nodemailer from "next-auth/providers/nodemailer";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { cookies, headers } from "next/headers";
import { authConfig } from "@/auth.config";
import { TenantPrismaAdapter } from "@/lib/auth-adapter";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { verifyPassword, verifyTotp } from "@/lib/security";
import { resolveLoginUser } from "@/lib/login-user";
import { findLoginTenantsForEmail } from "@/lib/login-tenants";
import { verifyLoginChallenge } from "@/lib/login-challenge";
import { demoLoginEnabled } from "@/lib/demo-login";
import { AUTH_TENANT_COOKIE } from "@/lib/constants";
import { loadTenantBrandingBySlug } from "@/lib/email/branding";
import { magicLinkMessage } from "@/lib/email/messages";
import { sendEmail } from "@/lib/email/send";
import type { Role } from "@prisma/client";

/**
 * Volledige Auth.js-instantie (server-side, Node-runtime): met de tenant-scoped
 * Prisma-adapter en de Nodemailer (magic link) provider.
 *
 * In development wordt de magic link naar de console gelogd i.p.v. gemaild
 * (zie sendVerificationRequest). Voor productie wordt hier later een echte
 * SMTP/Resend-transport ingehangen.
 */
// OAuth-providers worden alleen toegevoegd wanneer de credentials zijn gezet,
// zodat de app zonder OAuth-config blijft werken. Account-linking op e-mail is
// toegestaan: gebruikers zijn invite-only, dus de tenant-gebruiker bestaat al.
const oauthProviders: NextAuthConfig["providers"] = [];
if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  oauthProviders.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      allowDangerousEmailAccountLinking: true,
    })
  );
}
if (process.env.AUTH_MICROSOFT_ENTRA_ID_ID && process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET) {
  oauthProviders.push(
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
      issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
      allowDangerousEmailAccountLinking: true,
    })
  );
}

// Wachtwoordloze login voor demo-accounts (zie lib/demo-login.ts). Wordt alleen
// geregistreerd wanneer DEMO_LOGIN="true" (ook in productie — bewust voor demo's).
const demoProviders: NextAuthConfig["providers"] = [];
if (demoLoginEnabled()) {
  demoProviders.push(
    Credentials({
      id: "demo-login",
      name: "Demo login",
      credentials: { email: {} },
      async authorize(creds) {
        // Tweede slot op de deur: nooit autoriseren als demo-login uit staat.
        if (!demoLoginEnabled()) return null;
        const email = String(creds?.email ?? "").toLowerCase().trim();
        if (!email) return null;
        // Tenant-scoped resolutie via de login-cookie (zoals de wachtwoord-login).
        const user = await resolveLoginUser(email);
        if (!user || !user.active) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: user.tenantId,
          active: user.active,
        };
      },
    })
  );
}

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  ...authConfig,
  adapter: TenantPrismaAdapter(),
  providers: [
    Nodemailer({
      // Niet gebruikt in dev omdat we sendVerificationRequest overschrijven.
      server: { host: "localhost", port: 1025 },
      from: "no-reply@gymrebel.app",
      async sendVerificationRequest({ identifier, url }) {
        const email = identifier.toLowerCase().trim();
        const tenants = await findLoginTenantsForEmail(email);

        // Multi-gym: één gebrande, gelabelde link per sportschool. Elke link gaat
        // via /login/magic?t=<slug>, dat de tenant-cookie zet vóór Auth.js de
        // (gedeelde, eenmalige) token verifieert. De gebruiker klikt de juiste;
        // niets wordt on-screen prijsgegeven (alleen de mailbox-eigenaar ziet ze).
        if (tenants.length > 1) {
          const origin = new URL(url).origin;
          for (const t of tenants) {
            const wrapped = `${origin}/login/magic?t=${encodeURIComponent(t.slug)}&u=${encodeURIComponent(url)}`;
            const branding = await loadTenantBrandingBySlug(t.slug);
            await sendEmail({
              to: email,
              message: await magicLinkMessage({ branding, url: wrapped }),
              devLink: wrapped,
            });
          }
          return;
        }

        // 0 of 1 sportschool: branding uit de login-cookie of de enige tenant.
        const slug = (await cookies()).get(AUTH_TENANT_COOKIE)?.value ?? tenants[0]?.slug ?? null;
        const branding = await loadTenantBrandingBySlug(slug);
        await sendEmail({
          to: email,
          message: await magicLinkMessage({ branding, url }),
          devLink: url,
        });
      },
    }),
    Credentials({
      name: "Wachtwoord",
      credentials: { email: {}, password: {}, code: {}, challenge: {} },
      async authorize(creds) {
        const email = String(creds?.email ?? "").toLowerCase().trim();
        const password = String(creds?.password ?? "");
        const code = String(creds?.code ?? "");
        const challenge = String(creds?.challenge ?? "");
        if (!email) return null;

        const user = await resolveLoginUser(email);
        if (!user || !user.active) return null;

        // Stap 2 van de tweestaps-login: een geldige challenge bewijst dat het
        // wachtwoord al in stap 1 (server action) is geverifieerd. We hoeven het
        // wachtwoord dus niet opnieuw te checken — alleen de 2FA-code indien actief.
        if (challenge) {
          if (
            !verifyLoginChallenge(challenge, {
              email: user.email,
              tenantId: user.tenantId,
            })
          ) {
            return null;
          }
          if (user.twoFactorEnabled) {
            if (!user.twoFactorSecret || !verifyTotp(code, user.twoFactorSecret)) return null;
          }
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            tenantId: user.tenantId,
            active: user.active,
          };
        }

        // Directe wachtwoord-login (defense-in-depth; de UI gebruikt de
        // challenge-flow). 2FA-code blijft hier verplicht voor 2FA-gebruikers.
        if (!password || !user.passwordHash) return null;
        if (!(await verifyPassword(password, user.passwordHash))) return null;
        if (user.twoFactorEnabled) {
          if (!user.twoFactorSecret || !verifyTotp(code, user.twoFactorSecret)) return null;
        }
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: user.tenantId,
          active: user.active,
        };
      },
    }),
    ...oauthProviders,
    ...demoProviders,
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
      // Device-/sessie-registratie voor de "actieve sessies"-lijst.
      if (user.id) {
        try {
          const h = await headers();
          await prisma.userSession.create({
            data: {
              userId: user.id,
              userAgent: h.get("user-agent") ?? null,
              ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
            },
          });
        } catch {
          // sessie-registratie is best-effort
        }
      }
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
