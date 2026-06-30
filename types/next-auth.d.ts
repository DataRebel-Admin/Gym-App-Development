import type { Locale, Role } from "@prisma/client";
import type { DefaultSession } from "next-auth";

// Breidt de Auth.js-types uit met onze multitenant-velden (role, tenantId).
// tenantId is null voor SUPERADMIN (transcendeert tenants).
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      tenantId: string | null;
      locale?: Locale | null;
    } & DefaultSession["user"];
  }

  interface User {
    role: Role;
    tenantId: string | null;
    active?: boolean;
    locale?: Locale | null;
  }
}

declare module "next-auth/adapters" {
  interface AdapterUser {
    role: Role;
    tenantId: string | null;
    active?: boolean;
    locale?: Locale | null;
  }
}

// JWT-interface wordt gedeclareerd in @auth/core/jwt (next-auth/jwt re-exporteert
// die enkel), dus augmenteren we daar.
declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: Role;
    tenantId: string | null;
    locale?: Locale | null;
  }
}
