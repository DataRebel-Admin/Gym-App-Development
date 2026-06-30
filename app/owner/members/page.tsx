import Link from "next/link";
import { requireOwner } from "@/lib/owner";
import {
  listMembers,
  INVITE_STATUS_LABEL,
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

const ROLE_LABEL: Record<string, string> = {
  TENANT_ADMIN: "Beheerder",
  TENANT_MEMBER: "Lid",
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

export const metadata = { title: "Leden" };

export default async function OwnerMembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; sort?: string; archived?: string; page?: string }>;
}) {
  const owner = await requireOwner();
  const sp = await searchParams;

  const opts: MemberListOptions = {
    q: sp.q || undefined,
    status: STATUSES.includes(sp.status as InviteStatus) ? (sp.status as InviteStatus) : undefined,
    sort: sp.sort === "created" || sp.sort === "status" ? sp.sort : "name",
    includeArchived: sp.archived === "1",
    page: Math.max(1, Number(sp.page ?? "1") || 1),
  };
  const [{ rows: members, page, totalPages }, pendingInvites] = await Promise.all([
    listMembers(owner.tenantId, opts),
    listPendingInvitations({ tenantId: owner.tenantId }),
  ]);

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <SectionHeading
        title="Leden & beheerders"
        description="Beheer wie toegang heeft tot jouw sportschool."
      />

      <Card className="flex flex-col gap-3 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-900">Nieuw lid toevoegen</h2>
          <Link
            href="/owner/members/import"
            className={buttonClasses({ variant: "outline", size: "sm" })}
          >
            📥 Bulk importeren
          </Link>
        </div>
        <MemberAddForm />
      </Card>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-neutral-900">Uitstaande uitnodigingen</h2>
          {pendingInvites.length > 0 ? (
            <span className="text-xs text-neutral-500">{pendingInvites.length} openstaand</span>
          ) : null}
        </div>
        <PendingInvitationsTable
          rows={pendingInvites}
          resendAction={resendMemberInviteById}
          revokeAction={revokeMemberInvite}
        />
      </section>

      {/* Zoeken / filteren / sorteren */}
      <form method="get" className="flex flex-wrap items-end gap-3">
        <Field label="Zoeken" className="w-64">
          <Input name="q" defaultValue={sp.q ?? ""} placeholder="naam of e-mail…" />
        </Field>
        <Field label="Status" className="w-52">
          <Select name="status" defaultValue={sp.status ?? ""}>
            <option value="">Alle statussen</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {INVITE_STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Sorteren" className="w-44">
          <Select name="sort" defaultValue={opts.sort}>
            <option value="name">Naam</option>
            <option value="created">Nieuwste eerst</option>
            <option value="status">Status</option>
          </Select>
        </Field>
        <label className="flex items-center gap-2 pb-2.5 text-sm text-neutral-600">
          <input type="checkbox" name="archived" value="1" defaultChecked={opts.includeArchived} />
          Toon gearchiveerd
        </label>
        <button type="submit" className={buttonClasses({ variant: "secondary", size: "md" })}>
          Toepassen
        </button>
        <Link href="/owner/members" className="pb-2.5 text-sm text-neutral-500 hover:text-neutral-900">
          Wissen
        </Link>
      </form>

      <TableWrap>
        <Table>
          <Thead>
            <tr>
              <Th>Lid</Th>
              <Th>Status</Th>
              <Th>Rol</Th>
              <Th className="text-right">Acties</Th>
            </tr>
          </Thead>
          <Tbody>
            {members.length === 0 ? (
              <Tr>
                <Td colSpan={4} className="py-8 text-center text-neutral-500">
                  Geen leden gevonden.
                </Td>
              </Tr>
            ) : (
              members.map((m) => {
                const self = m.id === owner.id;
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
                            <Badge tone="neutral" className="mt-1">gearchiveerd</Badge>
                          ) : !m.active ? (
                            <Badge tone="warning" className="mt-1">gedeactiveerd</Badge>
                          ) : null}
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <Badge tone={STATUS_TONE[m.inviteStatus]}>
                        {INVITE_STATUS_LABEL[m.inviteStatus]}
                      </Badge>
                    </Td>
                    <Td>
                      <form action={setMemberRole} className="flex items-center gap-1">
                        <input type="hidden" name="userId" value={m.id} />
                        <Select name="role" defaultValue={m.role} className="h-8 w-32 py-1 text-xs">
                          <option value="TENANT_ADMIN">{ROLE_LABEL.TENANT_ADMIN}</option>
                          <option value="TENANT_MEMBER">{ROLE_LABEL.TENANT_MEMBER}</option>
                        </Select>
                        <button type="submit" className={rowBtn}>OK</button>
                      </form>
                    </Td>
                    <Td>
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        {canInvite ? (
                          <form action={resendInvite}>
                            <input type="hidden" name="userId" value={m.id} />
                            <button type="submit" className={rowBtn}>
                              {m.inviteStatus === "NIET_UITGENODIGD" ? "Uitnodigen" : "Opnieuw"}
                            </button>
                          </form>
                        ) : null}
                        {!self ? (
                          <>
                            <form action={m.archivedAt ? unarchiveMember : archiveMember}>
                              <input type="hidden" name="userId" value={m.id} />
                              <button type="submit" className={rowBtn}>
                                {m.archivedAt ? "Herstel" : "Archiveer"}
                              </button>
                            </form>
                            <form action={setMemberActive}>
                              <input type="hidden" name="userId" value={m.id} />
                              <input type="hidden" name="active" value={m.active ? "false" : "true"} />
                              <button type="submit" className={rowBtn}>
                                {m.active ? "Deactiveer" : "Activeer"}
                              </button>
                            </form>
                            <ConfirmButton
                              action={deleteMember}
                              fields={{ userId: m.id }}
                              label="Verwijder"
                              triggerClassName="rounded-lg border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                              title="Lid verwijderen?"
                              message={`Weet je zeker dat je ${m.name ?? m.email} definitief wilt verwijderen? Dit kan niet ongedaan worden gemaakt — overweeg archiveren.`}
                            />
                          </>
                        ) : (
                          <span className="text-xs text-neutral-400">(jij)</span>
                        )}
                      </div>
                    </Td>
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
              ← Vorige
            </Link>
          ) : (
            <span className="rounded-lg border border-border px-3 py-1.5 text-neutral-300">← Vorige</span>
          )}
          <span className="text-neutral-500">Pagina {page} / {totalPages}</span>
          {page < totalPages ? (
            <Link href={`/owner/members${buildQuery(sp, { page: String(page + 1) })}`} className="rounded-lg border border-border-strong px-3 py-1.5 hover:bg-neutral-50">
              Volgende →
            </Link>
          ) : (
            <span className="rounded-lg border border-border px-3 py-1.5 text-neutral-300">Volgende →</span>
          )}
        </div>
      ) : null}
    </div>
  );
}
