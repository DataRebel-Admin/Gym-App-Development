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
import { buttonClasses } from "@/components/ui/button";
import { MemberAddForm } from "./member-add-form";
import {
  setMemberRole,
  setMemberActive,
  deleteMember,
  archiveMember,
  unarchiveMember,
  resendInvite,
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

export default async function OwnerMembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; sort?: string; archived?: string }>;
}) {
  const owner = await requireOwner();
  const sp = await searchParams;

  const opts: MemberListOptions = {
    q: sp.q || undefined,
    status: STATUSES.includes(sp.status as InviteStatus) ? (sp.status as InviteStatus) : undefined,
    sort: sp.sort === "created" || sp.sort === "status" ? sp.sort : "name",
    includeArchived: sp.archived === "1",
  };
  const members = await listMembers(owner.tenantId, opts);

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
        Leden &amp; beheerders
      </h1>

      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-1 p-5">
        <h2 className="text-sm font-semibold text-neutral-900">Nieuw lid toevoegen</h2>
        <MemberAddForm />
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

      <div className="overflow-hidden rounded-2xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-medium">Lid</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Rol</th>
              <th className="px-4 py-3 font-medium text-right">Acties</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {members.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-neutral-500">
                  Geen leden gevonden.
                </td>
              </tr>
            ) : (
              members.map((m) => {
                const self = m.id === owner.id;
                const canInvite = m.inviteStatus !== "GEACTIVEERD";
                return (
                  <tr key={m.id} className={m.archivedAt ? "bg-neutral-50/60" : undefined}>
                    <td className="px-4 py-3">
                      <Link href={`/owner/members/${m.id}`} className="font-medium text-neutral-900 hover:underline">
                        {m.name ?? m.email}
                      </Link>
                      <p className="text-xs text-neutral-500">{m.email}</p>
                      {m.archivedAt ? (
                        <Badge tone="neutral" className="mt-1">gearchiveerd</Badge>
                      ) : !m.active ? (
                        <Badge tone="warning" className="mt-1">gedeactiveerd</Badge>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={STATUS_TONE[m.inviteStatus]}>
                        {INVITE_STATUS_LABEL[m.inviteStatus]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <form action={setMemberRole} className="flex items-center gap-1">
                        <input type="hidden" name="userId" value={m.id} />
                        <Select name="role" defaultValue={m.role} className="h-8 w-32 py-1 text-xs">
                          <option value="TENANT_ADMIN">{ROLE_LABEL.TENANT_ADMIN}</option>
                          <option value="TENANT_MEMBER">{ROLE_LABEL.TENANT_MEMBER}</option>
                        </Select>
                        <button type="submit" className={rowBtn}>OK</button>
                      </form>
                    </td>
                    <td className="px-4 py-3">
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
                            <form action={deleteMember}>
                              <input type="hidden" name="userId" value={m.id} />
                              <button type="submit" className="rounded-lg border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50">
                                Verwijder
                              </button>
                            </form>
                          </>
                        ) : (
                          <span className="text-xs text-neutral-400">(jij)</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
