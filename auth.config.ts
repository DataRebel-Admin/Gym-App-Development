import type { NextAuthConfig } from "next-auth";

/**
 * Edge-veilige Auth.js-config (zonder adapter / nodemailer), gedeeld door de
 * middleware en de volledige `auth.ts`. Bevat alleen pure callbacks zodat het
 * in de edge-runtime van de middleware kan draaien.
 */
export const authConfig = {
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    verifyRequest: "/login/check",
    error: "/login",
  },
  providers: [], // worden in auth.ts toegevoegd (Nodemailer)
  callbacks: {
    // Rol-bescherming wordt afgehandeld in proxy.ts (daar kunnen we ook de
    // tenant-header zetten), niet via een `authorized`-callback.

    /** Zet onze velden op het JWT-token bij login. */
    jwt({ token, user }) {
      if (user) {
        token.id = user.id ?? token.sub ?? "";
        token.role = user.role;
        token.tenantId = user.tenantId;
        if (user.email) token.email = user.email;
      }
      return token;
    },

    /** Maakt role, tenantId en email beschikbaar op de session. */
    session({ session, token }) {
      if (token) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.tenantId = token.tenantId;
        if (token.email) session.user.email = token.email;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
