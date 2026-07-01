import { getTranslations } from "next-intl/server";
import { requireOwner } from "@/lib/owner";
import { prisma } from "@/lib/db";
import {
  deriveInviteStatus,
  type InviteStatus,
} from "@/lib/members";
import { listPendingInvitations } from "@/lib/invitation";
import {
  getEffectivePermissions,
  type PermissionOverrides,
} from "@/lib/rbac";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { buttonClasses } from "@/components/ui/button-classes";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { SectionHeading } from "@/components/ui/section-heading";
import { Avatar } from "@/components/ui/avatar";
import { PendingInvitationsTable } from "@/components/invitations/pending-invitations-table";
import { PermissionMatrix } from "@/components/staff/permission-matrix";
import {
  inviteMember,
  setMemberActive,
  deleteMember,
  resendInvite,
  resendMemberInviteById,
  revokeMemberInvite,
} from "@/app/owner/members/actions";
import { setStaffPermissions } from "./actions";

export async function generateMetadata() {
  const t = await getTranslations("owner.staff");
  return { title: t("metaTitle") };
}

const STATUS_TONE: Record<InviteStatus, BadgeTone> = {
  GEACTIVEERD: "success",
  VERZONDEN: "accent",
  VERLOPEN: "danger",
  NIET_UITGENODIGD: "neutral",
};

const rowBtn =
  "rounded-lg border border-border-strong px-2 py-1 text-xs hover:bg-neutral-50";

export default async function OwnerStaffPage() {
  const owner = await requireOwner();
  const t = await getTranslations("owner.staff");

  const [staff, pendingInvites] = await Promise.all([
    prisma.user.findMany({
      where: { tenantId: owner.tenantId, role: "TENANT_STAFF" },
      orderBy: { name: "asc" },
      select: {
        id: true,
        email: true,
        name: true,
        active: true,
        emailVerified: true,
        permissions: true,
      },
    }),
    listPendingInvitations({ tenantId: owner.tenantId }),
  ]);

  const staffInvites = pendingInvites.filter((i) => i.role === "TENANT_STAFF");

  // Uitnodigingsstatus per medewerker.
  const invitations = await prisma.invitation.findMany({
    where: { tenantId: owner.tenantId, email: { in: staff.map((s) => s.email) } },
    select: { email: true, acceptedAt: true, expiresAt: true },
  });
  const inviteByEmail = new Map(invitations.map((i) => [i.email, i]));

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <SectionHeading
        title={t("title")}
        description={t("desc")}
      />

      {/* Medewerker uitnodigen */}
      <Card className="flex flex-col gap-3 p-5">
        <h2 className="text-sm font-semibold text-neutral-900">{t("inviteStaff")}</h2>
        <form action={inviteMember} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="role" value="TENANT_STAFF" />
          <Field label={t("emailLabel")} className="w-full sm:w-80">
            <Input name="email" type="email" required placeholder={t("emailPlaceholder")} />
          </Field>
          <button type="submit" className={buttonClasses({ size: "md" })}>
            {t("sendInvite")}
          </button>
        </form>
        <p className="text-xs text-neutral-500">
          {t("inviteHint")}
        </p>
      </Card>

      {/* Uitstaande uitnodigingen voor medewerkers */}
      {staffInvites.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-neutral-900">{t("pendingInvites")}</h2>
          <PendingInvitationsTable
            rows={staffInvites}
            resendAction={resendMemberInviteById}
            revokeAction={revokeMemberInvite}
          />
        </section>
      ) : null}

      {/* Medewerkers */}
      {staff.length === 0 ? (
        <Card className="p-8 text-center text-sm text-neutral-500">
          {t("noStaff")}
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {staff.map((s) => {
            const status = deriveInviteStatus(s, inviteByEmail.get(s.email));
            const canInvite = status !== "GEACTIVEERD";
            const enabled = [
              ...getEffectivePermissions(
                "TENANT_STAFF",
                (s.permissions as PermissionOverrides | null) ?? null
              ),
            ];
            return (
              <Card key={s.id} className="flex flex-col gap-4 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={s.name ?? s.email} status={s.active ? "online" : "offline"} />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-neutral-900">{s.name ?? s.email}</p>
                      <p className="truncate text-xs text-neutral-500">{s.email}</p>
                    </div>
                    <Badge tone={STATUS_TONE[status]}>{t(`status${status}`)}</Badge>
                    {!s.active ? <Badge tone="warning">{t("deactivated")}</Badge> : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {canInvite ? (
                      <form action={resendInvite}>
                        <input type="hidden" name="userId" value={s.id} />
                        <button type="submit" className={rowBtn}>
                          {status === "NIET_UITGENODIGD" ? t("invite") : t("resend")}
                        </button>
                      </form>
                    ) : null}
                    <form action={setMemberActive}>
                      <input type="hidden" name="userId" value={s.id} />
                      <input type="hidden" name="active" value={s.active ? "false" : "true"} />
                      <button type="submit" className={rowBtn}>
                        {s.active ? t("deactivate") : t("activate")}
                      </button>
                    </form>
                    <ConfirmButton
                      action={deleteMember}
                      fields={{ userId: s.id }}
                      label={t("remove")}
                      triggerClassName="rounded-lg border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                      title={t("removeTitle")}
                      message={t("removeMessage", { name: s.name ?? s.email })}
                    />
                  </div>
                </div>

                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    {t("rights")}
                  </h3>
                  <PermissionMatrix userId={s.id} enabled={enabled} action={setStaffPermissions} />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
