// Pure RBAC-helpers (geen Prisma/server-only import) zodat dit ook in Client
// Components bruikbaar is. Permissies zijn code-gedefinieerd per rol; later
// eenvoudig naar een DB-backed model te tillen zonder de call-sites te wijzigen.
import type { Role } from "@prisma/client";

export type Permission =
  | "tenant:manage" // tenants aanmaken/wijzigen/(de)activeren/verwijderen
  | "branding:manage" // huisstijl per tenant beheren
  | "user:invite" // gebruikers uitnodigen
  | "user:manage" // leden toevoegen/bewerken/verwijderen/(de)activeren
  | "role:assign" // rollen wijzigen
  | "audit:read"; // audit log inzien

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  SUPERADMIN: [
    "tenant:manage",
    "branding:manage",
    "user:invite",
    "user:manage",
    "role:assign",
    "audit:read",
  ],
  // Tenant-admin: alle gebruikersbeheer binnen de EIGEN tenant (afgedwongen via
  // assertTenantAccess). Geen tenant-/branding-beheer (dat is superadmin).
  TENANT_ADMIN: ["user:invite", "user:manage", "role:assign", "audit:read"],
  TENANT_MEMBER: [],
};

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export class ForbiddenError extends Error {
  constructor(message = "FORBIDDEN") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * Dwingt tenant-toegang af bij elke beheeractie. SUPERADMIN mag cross-tenant;
 * iedereen anders uitsluitend binnen de eigen tenant.
 */
export function assertTenantAccess(
  user: { role: Role; tenantId: string | null },
  tenantId: string
): void {
  if (user.role === "SUPERADMIN") return;
  if (user.tenantId !== tenantId) throw new ForbiddenError();
}
