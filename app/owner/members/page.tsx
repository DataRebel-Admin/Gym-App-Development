import { prisma } from "@/lib/db";
import { requireOwner } from "@/lib/owner";
import {
  inviteMember,
  revokeMemberInvite,
  setMemberRole,
  setMemberActive,
  deleteMember,
} from "./actions";

const ROLE_LABEL: Record<string, string> = {
  TENANT_ADMIN: "Beheerder",
  TENANT_MEMBER: "Lid",
};

export default async function OwnerMembersPage() {
  const owner = await requireOwner();

  const [users, invitations] = await Promise.all([
    prisma.user.findMany({
      where: { tenantId: owner.tenantId },
      orderBy: [{ role: "asc" }, { name: "asc" }],
      select: { id: true, email: true, name: true, role: true, active: true },
    }),
    prisma.invitation.findMany({
      where: { tenantId: owner.tenantId, acceptedAt: null },
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, role: true },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
        Leden &amp; beheerders
      </h1>

      <section className="flex max-w-2xl flex-col gap-4 rounded-xl border border-neutral-200 p-5">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">Uitnodigen</h2>
          <p className="mt-1 text-sm text-neutral-500">
            De uitnodigingslink verschijnt in de server-console (dev).
          </p>
        </div>
        <form action={inviteMember} className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
            E-mail
            <input
              type="email"
              name="email"
              required
              placeholder="naam@voorbeeld.nl"
              className="w-64 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
            Rol
            <select name="role" defaultValue="TENANT_MEMBER" className="rounded-lg border border-neutral-300 px-3 py-2 text-sm">
              <option value="TENANT_MEMBER">{ROLE_LABEL.TENANT_MEMBER}</option>
              <option value="TENANT_ADMIN">{ROLE_LABEL.TENANT_ADMIN}</option>
            </select>
          </label>
          <button type="submit" className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90">
            Uitnodigen
          </button>
        </form>
        {invitations.length > 0 ? (
          <ul className="flex flex-col divide-y divide-neutral-100">
            {invitations.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="text-neutral-700">
                  {inv.email} <span className="text-xs text-neutral-400">· {ROLE_LABEL[inv.role]}</span>
                </span>
                <form action={revokeMemberInvite}>
                  <input type="hidden" name="invitationId" value={inv.id} />
                  <button type="submit" className="text-xs text-neutral-400 hover:text-red-600">
                    Intrekken
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="flex max-w-2xl flex-col gap-2 rounded-xl border border-neutral-200 p-5">
        <h2 className="text-sm font-semibold text-neutral-900">Gebruikers</h2>
        <ul className="flex flex-col divide-y divide-neutral-100">
          {users.map((u) => {
            const self = u.id === owner.id;
            return (
              <li key={u.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-neutral-900">
                    {u.name ?? u.email}
                    {self ? <span className="ml-2 text-xs text-neutral-400">(jij)</span> : null}
                    {!u.active ? (
                      <span className="ml-2 rounded-full bg-neutral-200 px-2 py-0.5 text-xs text-neutral-600">
                        gedeactiveerd
                      </span>
                    ) : null}
                  </p>
                  <p className="truncate text-xs text-neutral-500">{u.email}</p>
                </div>
                <form action={setMemberRole} className="flex items-center gap-1">
                  <input type="hidden" name="userId" value={u.id} />
                  <select name="role" defaultValue={u.role} className="rounded-lg border border-neutral-300 px-2 py-1 text-sm">
                    <option value="TENANT_ADMIN">{ROLE_LABEL.TENANT_ADMIN}</option>
                    <option value="TENANT_MEMBER">{ROLE_LABEL.TENANT_MEMBER}</option>
                  </select>
                  <button type="submit" className="rounded-lg border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-50">
                    Wijzig
                  </button>
                </form>
                {!self ? (
                  <>
                    <form action={setMemberActive}>
                      <input type="hidden" name="userId" value={u.id} />
                      <input type="hidden" name="active" value={u.active ? "false" : "true"} />
                      <button type="submit" className="rounded-lg border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-50">
                        {u.active ? "Deactiveren" : "Activeren"}
                      </button>
                    </form>
                    <form action={deleteMember}>
                      <input type="hidden" name="userId" value={u.id} />
                      <button type="submit" className="rounded-lg border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50">
                        Verwijder
                      </button>
                    </form>
                  </>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
