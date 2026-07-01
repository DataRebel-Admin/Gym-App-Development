import "server-only";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import {
  getEffectivePermissions,
  type Permission,
  type PermissionOverrides,
} from "@/lib/rbac";
import { notifyInApp, type NotificationCategory } from "@/lib/notifications";
import { localeFromEnum, type AppLocale } from "@/lib/i18n/config";

type Translator = Awaited<ReturnType<typeof getTranslations>>;

/**
 * Notificeer alle actieve tenant-gebruikers (eigenaar + medewerkers) die een
 * bepaalde permissie bezitten — bv. een nieuwe schema-aanvraag naar iedereen die
 * schema's beheert. Respecteert de meldingsvoorkeuren (via `notifyInApp`) en
 * faalt nooit hard.
 *
 * `render` bouwt titel/body in de **taal van elke ontvanger** (per-locale
 * root-translator), zodat een Fryske coach een Fryske melding krijgt.
 */
export async function notifyStaffWithPermission(opts: {
  tenantId: string;
  permission: Permission;
  category: NotificationCategory;
  render: (t: Translator) => { title: string; body?: string | null };
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
    select: { id: true, role: true, permissions: true, locale: true },
  });

  const eligible = users
    .filter((u) => u.id !== opts.excludeUserId)
    .filter((u) =>
      getEffectivePermissions(
        u.role,
        (u.permissions as PermissionOverrides | null) ?? null
      ).has(opts.permission)
    );

  // Translator per locale hergebruiken (max 3 lookups i.p.v. één per ontvanger).
  const trCache = new Map<AppLocale, Translator>();
  const trFor = async (loc: AppLocale): Promise<Translator> => {
    const cached = trCache.get(loc);
    if (cached) return cached;
    const t = await getTranslations({ locale: loc });
    trCache.set(loc, t);
    return t;
  };

  await Promise.all(
    eligible.map(async (u) => {
      const t = await trFor(localeFromEnum(u.locale));
      const { title, body } = opts.render(t);
      return notifyInApp({
        userId: u.id,
        tenantId: opts.tenantId,
        category: opts.category,
        title,
        body: body ?? null,
        link: opts.link ?? null,
      });
    })
  );
}
