import "server-only";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { localeFromEnum } from "@/lib/i18n/config";
import { notifyStaffWithPermission } from "@/lib/staff-notify";
import { notifyInApp } from "@/lib/notifications";
import { loadTenantBranding } from "@/lib/email/branding";
import { shouldNotify } from "@/lib/notifications";
import { sendEmail } from "@/lib/email/send";
import {
  memberSchemaSubmittedMessage,
  memberSchemaReviewedMessage,
} from "@/lib/email/messages";

/**
 * Meldingen rond zelf-gebouwde lid-schema's. Hergebruikt de bestaande
 * notificatie-infrastructuur (in-app + e-mail, voorkeur-gerespecteerd) en faalt
 * nooit hard — een verzendfout mag de business-actie niet breken.
 */

/** Lid heeft een schema ingediend → informeer coaches met schemas:manage. */
export async function notifyMemberSchemaSubmitted(opts: {
  tenantId: string;
  memberName: string;
  schemaName: string;
  reviewLink: string;
  excludeUserId?: string;
}): Promise<void> {
  try {
    await notifyStaffWithPermission({
      tenantId: opts.tenantId,
      permission: "schemas:manage",
      category: "schemas",
      render: (t) => ({
        title: t("notifications.memberSchema.submitTitle"),
        body: t("notifications.memberSchema.submitBody", {
          member: opts.memberName,
          schema: opts.schemaName,
        }),
      }),
      link: opts.reviewLink,
      excludeUserId: opts.excludeUserId,
    });
  } catch (err) {
    console.error("✗ Melding zelf-schema ingediend mislukt:", (err as Error).message);
  }
}

/** Coach keurde een zelf-gebouwd schema goed of af → informeer het lid (in-app + e-mail). */
export async function notifyMemberSchemaReviewed(opts: {
  tenantId: string;
  memberId: string;
  memberEmail: string;
  memberName: string | null;
  approved: boolean;
  schemaName: string;
  reviewNote?: string | null;
  viewUrl: string;
}): Promise<void> {
  const member = await prisma.user.findUnique({
    where: { id: opts.memberId },
    select: { locale: true },
  });
  const t = await getTranslations({ locale: localeFromEnum(member?.locale) });
  const title = opts.approved
    ? t("notifications.memberSchema.approvedTitle")
    : t("notifications.memberSchema.rejectedTitle");
  const body = opts.approved
    ? t("notifications.memberSchema.approvedBody", { schema: opts.schemaName })
    : opts.reviewNote
      ? t("notifications.memberSchema.rejectedBodyNote", {
          schema: opts.schemaName,
          note: opts.reviewNote,
        })
      : t("notifications.memberSchema.rejectedBody", { schema: opts.schemaName });

  try {
    await notifyInApp({
      userId: opts.memberId,
      tenantId: opts.tenantId,
      category: "schemas",
      title,
      body,
      link: "/member/schema/builder",
    });
  } catch (err) {
    console.error("✗ In-app melding review mislukt:", (err as Error).message);
  }

  try {
    if (await shouldNotify(opts.memberId, "schemas", "email")) {
      const branding = await loadTenantBranding(opts.tenantId);
      await sendEmail({
        to: opts.memberEmail,
        message: await memberSchemaReviewedMessage({
          branding,
          recipientName: opts.memberName,
          schemaName: opts.schemaName,
          approved: opts.approved,
          reviewNote: opts.reviewNote ?? null,
          viewUrl: opts.viewUrl,
          locale: member?.locale,
        }),
        devLink: opts.viewUrl,
      });
    }
  } catch (err) {
    console.error("✗ E-mail review mislukt:", (err as Error).message);
  }
}

/**
 * Optioneel: stuur coaches óók een e-mail bij een nieuwe inzending. In-app is de
 * primaire route (notifyMemberSchemaSubmitted); e-mail is best-effort per coach.
 */
export async function emailCoachesSchemaSubmitted(opts: {
  tenantId: string;
  memberName: string;
  schemaName: string;
  reviewUrl: string;
}): Promise<void> {
  try {
    const coaches = await prisma.user.findMany({
      where: {
        tenantId: opts.tenantId,
        active: true,
        archivedAt: null,
        role: { in: ["TENANT_ADMIN", "TENANT_STAFF"] },
      },
      select: { id: true, email: true, name: true, permissions: true, role: true, locale: true },
    });
    const { getEffectivePermissions } = await import("@/lib/rbac");
    const branding = await loadTenantBranding(opts.tenantId);
    for (const c of coaches) {
      const perms = getEffectivePermissions(
        c.role,
        (c.permissions as Record<string, boolean> | null) ?? null
      );
      if (!perms.has("schemas:manage")) continue;
      if (!(await shouldNotify(c.id, "schemas", "email"))) continue;
      await sendEmail({
        to: c.email,
        message: await memberSchemaSubmittedMessage({
          branding,
          recipientName: c.name,
          memberName: opts.memberName,
          schemaName: opts.schemaName,
          reviewUrl: opts.reviewUrl,
          locale: c.locale,
        }),
        devLink: opts.reviewUrl,
      });
    }
  } catch (err) {
    console.error("✗ Coach-e-mail zelf-schema mislukt:", (err as Error).message);
  }
}
