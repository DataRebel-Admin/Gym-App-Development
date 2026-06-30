import "server-only";
import { prisma } from "@/lib/db";
import {
  getEffectivePermissions,
  type Permission,
  type PermissionOverrides,
} from "@/lib/rbac";
import { notifyInApp, type NotificationCategory } from "@/lib/notifications";

/**
 * Notificeer alle actieve tenant-gebruikers (eigenaar + medewerkers) die een
 * bepaalde permissie bezitten — bv. een nieuwe schema-aanvraag naar iedereen die
 * schema's beheert. Respecteert de meldingsvoorkeuren (via `notifyInApp`) en
 * faalt nooit hard.
 */
export async function notifyStaffWithPermission(opts: {
  tenantId: string;
  permission: Permission;
  category: NotificationCategory;
  title: string;
  body?: string | null;
  link?: string | null;
  /** Sluit de veroorzaker uit (geen melding aan jezelf). */
  excludeUserId?: string;
}): Promise<void> {
  const users = await prisma.user.findMany({
    where: {
      tenantId: opts.tenantId,
      active: true,
      archivedAt: null,
      role: { in: ["TENANT_ADMIN", "TENANT_STAFF"] },
    },
    select: { id: true, role: true, permissions: true },
  });

  await Promise.all(
    users
      .filter((u) => u.id !== opts.excludeUserId)
      .filter((u) =>
        getEffectivePermissions(
          u.role,
          (u.permissions as PermissionOverrides | null) ?? null
        ).has(opts.permission)
      )
      .map((u) =>
        notifyInApp({
          userId: u.id,
          tenantId: opts.tenantId,
          category: opts.category,
          title: opts.title,
          body: opts.body ?? null,
          link: opts.link ?? null,
        })
      )
  );
}
