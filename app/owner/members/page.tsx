import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { useTranslations } from "next-intl";
import { requirePermission } from "@/lib/staff";
import {
  listMembers,
  type InviteStatus,
  type MemberListOptions,
} from "@/lib/members";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Field, Input, Select } from "@/components/ui/field";
import { buttonClasses } from "@/components/ui/button-classes";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { SectionHeading } from "@/components/ui/section-heading";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import {
  TableWrap,
  Table,
  Thead,
  Th,
  Tbody,
  Tr,
  Td,
} from "@/components/ui/table";
import { listPendingInvitations } from "@/lib/invitation";
import { PendingInvitationsTable } from "@/components/invitations/pending-invitations-table";
import { MemberAddForm } from "./member-add-form";
import {
  setMemberRole,
  setMemberActive,
  deleteMember,
  archiveMember,
  unarchiveMember,
  resendInvite,
  resendMemberInviteById,
  revokeMemberInvite,
} from "./actions";

const ROLE_KEY: Record<string, "roleAdmin" | "roleStaff" | "roleMember"> = {
  TENANT_ADMIN: "roleAdmin",
  TENANT_STAFF: "roleStaff",
  TENANT_MEMBER: "roleMember",
};

const STATUS_TONE: Record<InviteStatus, BadgeTone> = {
  GEACTIVEERD: "success",
  VERZONDEN: "accent",
  VERLOPEN: "danger",
  NIET_UITGENODIGD: "neutral",
};

const STATUSES: InviteStatus[] = [
  "NIET_UITGENODIGD",
  "VERZONDEN",
  "GEACTIVEERD",
  "VERLOPEN",
];

const rowBtn = "rounded-lg border border-border-strong px-2 py-1 text-xs hover:bg-neutral-50";

function buildQuery(base: Record<string, string | undefined>, overrides: Record<string, string>) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...base, ...overrides })) if (v) params.set(k, v);
  const s = params.toString();
  return s ? `?${s}` : "";
}

export async function generateMetadata() {
  const t = await getTranslations("owner.members");
  return { title: t("metaTitle") };
}

export default async function OwnerMembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; sort?: string; archived?: string; page?: string; mine?: string }>;
}) {
  const me = await requirePermission("members:view");
  const t = await getTranslations("owner.members");
  const isAdmin = me.role === "TENANT_ADMIN";
  const sp = await searchParams;

  const mineOnly = sp.mine === "1";
  const opts: MemberListOptions = {
    q: sp.q || undefined,
    status: STATUSES.includes(sp.status as InviteStatus) ? (sp.status as InviteStatus) : undefined,
    sort: sp.sort === "created" || sp.sort === "status" ? sp.sort : "name",
    includeArchived: sp.archived === "1",
    coachId: mineOnly ? me.id : undefined,
    page: Math.max(1, Number(sp.page ?? "1") || 1),
  };
  const [{ rows: members, page, totalPages }, pendingInvites] = await Promise.all([
    listMembers(me.tenantId, opts),
    // Medewerkers hoeven geen uitstaande uitnodigingen te zien (administratief).
    isAdmin ? listPendingInvitations({ tenantId: me.tenantId }) : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <SectionHeading
        title={isAdmin ? t("titleAdmin") : t("titleStaff")}
        description={isAdmin ? t("descAdmin") : t("descStaff")}
      />

      {/* Mijn leden ↔ Alle leden (coach-koppeling) */}
      <div className="flex w-fit gap-1 rounded-xl border border-border bg-surface-1 p-1 text-sm">
        <Link
          href="/owner/members"
          className={`rounded-lg px-3 py-1.5 font-medium ${!mineOnly ? "bg-accent text-accent-foreground shadow-sm" : "text-neutral-600 hover:text-neutral-900"}`}
        >
          {t("allMembers")}
        </Link>
        <Link
          href="/owner/members?mine=1"
          className={`rounded-lg px-3 py-1.5 font-medium ${mineOnly ? "bg-accent text-accent-foreground shadow-sm" : "text-neutral-600 hover:text-neutral-900"}`}
        >
          {t("myMembers")}
        </Link>
      </div>

      {/* Ledenadministratie is exclusief voor de eigenaar. */}
      {isAdmin ? (
        <>
          <Card className="flex flex-col gap-3 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-neutral-900">{t("addMember")}</h2>
              <Link
                href="/owner/members/import"
                className={buttonClasses({ variant: "outline", size: "sm" })}
              >
                {t("bulkImport")}
              </Link>
            </div>
            <MemberAddForm />
          </Card>

          <section className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-neutral-900">{t("pendingInvites")}</h2>
              {pendingInvites.length > 0 ? (
                <span className="text-xs text-neutral-500">{t("openCount", { count: pendingInvites.length })}</span>
              ) : null}
            </div>
            <PendingInvitationsTable
              rows={pendingInvites}
              resendAction={resendMemberInviteById}
              revokeAction={revokeMemberInvite}
            />
          </section>
        </>
      ) : null}

      {/* Zoeken / filteren / sorteren */}
      <form method="get" className="flex flex-wrap items-end gap-3">
        <Field label={t("search")} className="w-full sm:w-64">
          <Input name="q" defaultValue={sp.q ?? ""} placeholder={t("searchPlaceholder")} />
        </Field>
        <Field label={t("status")} className="w-full sm:w-52">
          <Select name="status" defaultValue={sp.status ?? ""}>
            <option value="">{t("allStatuses")}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`status${s}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("sort")} className="w-full sm:w-44">
          <Select name="sort" defaultValue={opts.sort}>
            <option value="name">{t("sortName")}</option>
            <option value="created">{t("sortNewest")}</option>
            <option value="status">{t("sortStatus")}</option>
          </Select>
        </Field>
        <label className="flex items-center gap-2 pb-2.5 text-sm text-neutral-600">
          <input type="checkbox" name="archived" value="1" defaultChecked={opts.includeArchived} />
          {t("showArchived")}
        </label>
        <button type="submit" className={buttonClasses({ variant: "secondary", size: "md" })}>
          {t("apply")}
        </button>
        <Link href="/owner/members" className="pb-2.5 text-sm text-neutral-500 hover:text-neutral-900">
          {t("clear")}
        </Link>
      </form>

      {/* Mobiel: kaarten */}
      <div className="flex flex-col gap-3 md:hidden">
        {members.length === 0 ? (
          <p className="py-8 text-center text-sm text-neutral-500">{t("noMembers")}</p>
        ) : (
          members.map((m) => {
            const self = m.id === me.id;
            const canInvite = m.inviteStatus !== "GEACTIVEERD";
            return (
              <div
                key={m.id}
                className={`rounded-2xl border border-border bg-surface-1 p-4 shadow-sm ${m.archivedAt ? "opacity-60" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={m.name ?? m.email} status={m.active ? "online" : "offline"} />
                    <div className="min-w-0">
                      <Link href={`/owner/members/${m.id}`} className="block truncate font-medium text-neutral-900 hover:underline">
                        {m.name ?? m.email}
                      </Link>
                      <p className="truncate text-xs text-neutral-500">{m.email}</p>
                    </div>
                  </div>
                  <Badge tone={STATUS_TONE[m.inviteStatus]}>
                    {t(`status${m.inviteStatus}`)}
                  </Badge>
                </div>
                {m.archivedAt ? (
                  <Badge tone="neutral" className="mt-2">{t("archived")}</Badge>
                ) : !m.active ? (
                  <Badge tone="warning" className="mt-2">{t("deactivated")}</Badge>
                ) : null}
                {isAdmin ? (
                  <>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <MemberRoleForm id={m.id} role={m.role} />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <MemberActions m={m} self={self} canInvite={canInvite} />
                    </div>
                  </>
                ) : (
                  <Badge tone="neutral" className="mt-3">{ROLE_KEY[m.role] ? t(ROLE_KEY[m.role]) : m.role}</Badge>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Desktop: tabel */}
      <TableWrap className="hidden md:block">
        <Table>
          <Thead>
            <tr>
              <Th>{t("colMember")}</Th>
              <Th>{t("colStatus")}</Th>
              <Th>{t("colRole")}</Th>
              {isAdmin ? <Th className="text-right">{t("colActions")}</Th> : null}
            </tr>
          </Thead>
          <Tbody>
            {members.length === 0 ? (
              <Tr>
                <Td colSpan={isAdmin ? 4 : 3} className="py-8 text-center text-neutral-500">
                  {t("noMembers")}
                </Td>
              </Tr>
            ) : (
              members.map((m) => {
                const self = m.id === me.id;
                const canInvite = m.inviteStatus !== "GEACTIVEERD";
                return (
                  <Tr key={m.id} className={m.archivedAt ? "opacity-60" : undefined}>
                    <Td>
                      <div className="flex items-center gap-3">
                        <Avatar
                          name={m.name ?? m.email}
                          status={m.active ? "online" : "offline"}
                        />
                        <div>
                          <Link href={`/owner/members/${m.id}`} className="font-medium text-neutral-900 hover:underline">
                            {m.name ?? m.email}
                          </Link>
                          <p className="text-xs text-neutral-500">{m.email}</p>
                          {m.archivedAt ? (
                            <Badge tone="neutral" className="mt-1">{t("archived")}</Badge>
                          ) : !m.active ? (
                            <Badge tone="warning" className="mt-1">{t("deactivated")}</Badge>
                          ) : null}
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <Badge tone={STATUS_TONE[m.inviteStatus]}>
                        {t(`status${m.inviteStatus}`)}
                      </Badge>
                    </Td>
                    <Td>
                      {isAdmin ? (
                        <MemberRoleForm id={m.id} role={m.role} />
                      ) : (
                        <Badge tone="neutral">{ROLE_KEY[m.role] ? t(ROLE_KEY[m.role]) : m.role}</Badge>
                      )}
                    </Td>
                    {isAdmin ? (
                      <Td>
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          <MemberActions m={m} self={self} canInvite={canInvite} />
                        </div>
                      </Td>
                    ) : null}
                  </Tr>
                );
              })
            )}
          </Tbody>
        </Table>
      </TableWrap>

      {totalPages > 1 ? (
        <div className="flex items-center justify-center gap-4 text-sm">
          {page > 1 ? (
            <Link href={`/owner/members${buildQuery(sp, { page: String(page - 1) })}`} className="rounded-lg border border-border-strong px-3 py-1.5 hover:bg-neutral-50">
              {t("prev")}
            </Link>
          ) : (
            <span className="rounded-lg border border-border px-3 py-1.5 text-neutral-300">{t("prev")}</span>
          )}
          <span className="text-neutral-500">{t("pageOf", { page, total: totalPages })}</span>
          {page < totalPages ? (
            <Link href={`/owner/members${buildQuery(sp, { page: String(page + 1) })}`} className="rounded-lg border border-border-strong px-3 py-1.5 hover:bg-neutral-50">
              {t("next")}
            </Link>
          ) : (
            <span className="rounded-lg border border-border px-3 py-1.5 text-neutral-300">{t("next")}</span>
          )}
        </div>
      ) : null}
    </div>
  );
}

/** Velden die de mobiele kaart + de tabel delen (zelfde server-actions). */
type MemberActionRow = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  active: boolean;
  archivedAt: Date | null;
  inviteStatus: InviteStatus;
};

function MemberRoleForm({ id, role }: { id: string; role: string }) {
  const t = useTranslations("owner.members");
  return (
    <form action={setMemberRole} className="flex items-center gap-1">
      <input type="hidden" name="userId" value={id} />
      <Select name="role" defaultValue={role} className="h-8 w-32 py-1 text-xs">
        <option value="TENANT_ADMIN">{t("roleAdmin")}</option>
        <option value="TENANT_MEMBER">{t("roleMember")}</option>
      </Select>
      <button type="submit" className={rowBtn}>{t("ok")}</button>
    </form>
  );
}

function MemberActions({
  m,
  self,
  canInvite,
}: {
  m: MemberActionRow;
  self: boolean;
  canInvite: boolean;
}) {
  const t = useTranslations("owner.members");
  return (
    <>
      {canInvite ? (
        <form action={resendInvite}>
          <input type="hidden" name="userId" value={m.id} />
          <button type="submit" className={rowBtn}>
            {m.inviteStatus === "NIET_UITGENODIGD" ? t("invite") : t("resend")}
          </button>
        </form>
      ) : null}
      {!self ? (
        <>
          <form action={m.archivedAt ? unarchiveMember : archiveMember}>
            <input type="hidden" name="userId" value={m.id} />
            <button type="submit" className={rowBtn}>
              {m.archivedAt ? t("restore") : t("archive")}
            </button>
          </form>
          <form action={setMemberActive}>
            <input type="hidden" name="userId" value={m.id} />
            <input type="hidden" name="active" value={m.active ? "false" : "true"} />
            <button type="submit" className={rowBtn}>
              {m.active ? t("deactivate") : t("activate")}
            </button>
          </form>
          <ConfirmButton
            action={deleteMember}
            fields={{ userId: m.id }}
            label={t("remove")}
            triggerClassName="rounded-lg border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
            title={t("removeTitle")}
            message={t("removeMessage", { name: m.name ?? m.email })}
          />
        </>
      ) : (
        <span className="text-xs text-neutral-400">{t("you")}</span>
      )}
    </>
  );
}
