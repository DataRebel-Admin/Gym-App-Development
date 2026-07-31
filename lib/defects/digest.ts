import "server-only";
import { del } from "@vercel/blob";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { isFeatureEnabled } from "@/lib/features/service";
import { blobConfigured, blobToken } from "@/lib/blob";
import { loadTenantBranding } from "@/lib/email/branding";
import { OPEN_DEFECT_STATUSES } from "@/lib/defects";
import { appBaseUrl } from "@/lib/app-url";
import {
  getDefectRecipients,
  defectRecipientsForLocation,
  deliverDefectToAll,
} from "@/lib/defects/notify";

const DAY_MS = 86_400_000;
/** Foto's wissen 12 maanden na afronding (AVG). */
const PHOTO_RETENTION_DAYS = 365;
/** Meldingen verwijderen 24 maanden na afronding (AVG). */
const DEFECT_RETENTION_DAYS = 730;

const openStatuses = [...OPEN_DEFECT_STATUSES];

/**
 * Dagelijkse samenvatting per tenant: nieuwe MINOR/MAJOR-meldingen (idempotent
 * via `digestedAt`; UNSAFE is al direct gemeld) + achterstand (open meldingen
 * ouder dan `Tenant.defectReminderDays` — mag dagelijks herhalen). Per
 * vestiging bezorgd aan behandelaars mét toegang tot die vestiging.
 */
export async function runDefectsDigest(tenantId: string, origin?: string): Promise<number> {
  if (!(await isFeatureEnabled(tenantId, "defects"))) return 0;
  const resolvedOrigin = origin ?? appBaseUrl();

  const tenant = await prisma.tenant.findFirst({
    where: { id: tenantId, deletedAt: null },
    select: { defectReminderDays: true },
  });
  if (!tenant) return 0;

  const now = new Date();
  const overdueCutoff = new Date(
    now.getTime() - Math.max(1, tenant.defectReminderDays) * DAY_MS
  );

  const [fresh, overdue] = await Promise.all([
    prisma.equipmentDefect.findMany({
      where: { tenantId, digestedAt: null, severity: { in: ["MINOR", "MAJOR"] } },
      select: { id: true, locationId: true },
    }),
    prisma.equipmentDefect.findMany({
      where: { tenantId, status: { in: openStatuses }, createdAt: { lte: overdueCutoff } },
      select: { id: true, locationId: true },
    }),
  ]);
  if (fresh.length === 0 && overdue.length === 0) return 0;

  const [recipients, branding, locations] = await Promise.all([
    getDefectRecipients(tenantId),
    loadTenantBranding(tenantId),
    prisma.location.findMany({
      where: { tenantId },
      select: { id: true, name: true },
    }),
  ]);
  const locationName = new Map(locations.map((l) => [l.id, l.name]));

  // Per vestiging: eigen tellingen, eigen ontvangers (deny-by-default).
  const byLocation = new Map<string, { fresh: number; overdue: number }>();
  for (const d of fresh) {
    const row = byLocation.get(d.locationId) ?? { fresh: 0, overdue: 0 };
    row.fresh += 1;
    byLocation.set(d.locationId, row);
  }
  for (const d of overdue) {
    const row = byLocation.get(d.locationId) ?? { fresh: 0, overdue: 0 };
    row.overdue += 1;
    byLocation.set(d.locationId, row);
  }

  let reached = 0;
  for (const [locationId, counts] of byLocation) {
    const locRecipients = defectRecipientsForLocation(recipients, locationId);
    if (locRecipients.length === 0) continue;
    reached += await deliverDefectToAll({
      tenantId,
      recipients: locRecipients,
      branding,
      origin: resolvedOrigin,
      machineLabel: locationName.get(locationId) ?? "vestiging",
      build: (t) => ({
        title: t("notifications.defects.digestTitle"),
        body: t("notifications.defects.digestBody", {
          new: counts.fresh,
          overdue: counts.overdue,
        }),
        detail: t("notifications.defects.digestDetail"),
      }),
    });
  }

  // Idempotentie: nieuwe meldingen markeren (achterstand herhaalt bewust).
  if (fresh.length > 0) {
    await prisma.equipmentDefect.updateMany({
      where: { id: { in: fresh.map((d) => d.id) } },
      data: { digestedAt: now },
    });
  }

  await audit("defect.digest.sent", {
    actor: { email: "systeem", role: null },
    tenantId,
    metadata: { count: fresh.length, overdue: overdue.length, recipients: reached },
  });
  return reached;
}

/**
 * AVG-opschoning (alle tenants): foto's wissen 12 maanden na afronding,
 * meldingen verwijderen 24 maanden na afronding. Best-effort per rij.
 */
export async function cleanupDefects(): Promise<{ photos: number; removed: number }> {
  const now = Date.now();
  const photoCutoff = new Date(now - PHOTO_RETENTION_DAYS * DAY_MS);
  const deleteCutoff = new Date(now - DEFECT_RETENTION_DAYS * DAY_MS);
  const closed = ["RESOLVED", "REJECTED"] as const;

  // 1) Foto's wissen (Blob + kolom leegmaken).
  const withPhotos = await prisma.equipmentDefect.findMany({
    where: {
      status: { in: [...closed] },
      resolvedAt: { not: null, lte: photoCutoff },
      photoKeys: { isEmpty: false },
    },
    select: { id: true, tenantId: true, photoKeys: true },
  });
  let photos = 0;
  const photosByTenant = new Map<string, number>();
  for (const defect of withPhotos) {
    try {
      if (blobConfigured()) {
        const urls = defect.photoKeys.filter((k) => /^https?:\/\//.test(k));
        if (urls.length > 0) await del(urls, { token: blobToken() }).catch(() => {});
      }
      await prisma.equipmentDefect.update({
        where: { id: defect.id },
        data: { photoKeys: [] },
      });
      photos += defect.photoKeys.length;
      photosByTenant.set(
        defect.tenantId,
        (photosByTenant.get(defect.tenantId) ?? 0) + defect.photoKeys.length
      );
    } catch (err) {
      console.error("[defects] foto-opschoning mislukt:", defect.id, (err as Error).message);
    }
  }

  // 2) Oude afgeronde meldingen definitief verwijderen (bevestigingen cascaden).
  const tenants = await prisma.equipmentDefect.groupBy({
    by: ["tenantId"],
    where: { status: { in: [...closed] }, resolvedAt: { not: null, lte: deleteCutoff } },
    _count: { _all: true },
  });
  const { count: removed } = await prisma.equipmentDefect.deleteMany({
    where: { status: { in: [...closed] }, resolvedAt: { not: null, lte: deleteCutoff } },
  });

  // Eén audit-regel per tenant met opgeschoonde meldingen en/of foto's.
  const removedByTenant = new Map(tenants.map((t) => [t.tenantId, t._count._all]));
  const affectedTenants = new Set([...removedByTenant.keys(), ...photosByTenant.keys()]);
  for (const tId of affectedTenants) {
    await audit("defect.cleanup", {
      actor: { email: "systeem", role: null },
      tenantId: tId,
      metadata: {
        removed: removedByTenant.get(tId) ?? 0,
        photos: photosByTenant.get(tId) ?? 0,
      },
    });
  }
  return { photos, removed };
}
