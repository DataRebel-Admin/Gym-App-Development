import "server-only";
import { prisma } from "@/lib/db";

export type UserTenant = { id: string; slug: string; name: string };

/**
 * Alle actieve tenants waar dit e-mailadres een actief (niet-gearchiveerd)
 * tenant-account heeft. E-mail is uniek *per tenant*, dus dezelfde persoon kan
 * bij meerdere sportscholen horen — basis voor de tenant-switcher.
 */
export async function getUserTenants(email: string): Promise<UserTenant[]> {
  const rows = await prisma.user.findMany({
    where: {
      email,
      active: true,
      archivedAt: null,
      role: { in: ["TENANT_ADMIN", "TENANT_MEMBER"] },
      tenant: { is: { status: "ACTIVE", deletedAt: null } },
    },
    select: { tenant: { select: { id: true, slug: true, name: true } } },
  });

  return rows
    .map((r) => r.tenant)
    .filter((t): t is UserTenant => Boolean(t))
    .sort((a, b) => a.name.localeCompare(b.name));
}
