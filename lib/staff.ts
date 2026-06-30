import "server-only";
import { cache } from "react";
import { redirect, unauthorized, forbidden } from "next/navigation";
import type { Role } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  getEffectivePermissions,
  type Permission,
  type PermissionOverrides,
} from "@/lib/rbac";

export type TenantUser = {
  id: string;
  email?: string | null;
  name?: string | null;
  role: Role;
  tenantId: string;
  /** Effectieve permissies (role-default + per-medewerker override). */
  permissions: Set<Permission>;
};

/**
 * Vereist een ingelogde tenant-gebruiker — eigenaar (`TENANT_ADMIN`) óf medewerker
 * (`TENANT_STAFF`) — en levert de effectieve permissies mee. De `/owner`-area is
 * een gedeelde werkruimte: de admin heeft impliciet álle tenant-permissies, een
 * medewerker een per-persoon configureerbare subset.
 *
 * Niet ingelogd → premium 401; verkeerde rol → premium 403. Per-request gecachet.
 */
export const requireTenantUser = cache(async (): Promise<TenantUser> => {
  const session = await auth();
  if (!session?.user) unauthorized();
  const role = session.user.role;
  if (role !== "TENANT_ADMIN" && role !== "TENANT_STAFF") forbidden();
  // Data-integriteit: een tenant-gebruiker zonder tenant is een kapotte sessie.
  if (!session.user.tenantId) redirect("/login");

  // Alleen een medewerker heeft per-persoon overrides; admin = volledige superset.
  let overrides: PermissionOverrides | null = null;
  if (role === "TENANT_STAFF") {
    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { permissions: true },
    });
    overrides = (dbUser?.permissions as PermissionOverrides | null) ?? null;
  }

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role,
    tenantId: session.user.tenantId,
    permissions: getEffectivePermissions(role, overrides),
  };
});

/**
 * Vereist een tenant-gebruiker mét de gevraagde permissie. De admin passeert altijd
 * (superset). Een medewerker zonder de permissie → premium 403. Gebruik dit op alle
 * gedeelde pagina's en server-actions die niet admin-exclusief zijn.
 */
export async function requirePermission(
  permission: Permission
): Promise<TenantUser> {
  const user = await requireTenantUser();
  if (!user.permissions.has(permission)) forbidden();
  return user;
}
