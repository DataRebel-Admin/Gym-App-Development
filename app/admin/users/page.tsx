import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSuperadmin } from "@/lib/superadmin";
import { listPendingInvitations } from "@/lib/invitation";
import { Avatar } from "@/components/ui/avatar";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import {
  TableWrap,
  Table,
  Thead,
  Th,
  Tbody,
  Tr,
  Td,
} from "@/components/ui/table";
import { PendingInvitationsTable } from "@/components/invitations/pending-invitations-table";
import { InviteUserForm } from "./invite-user-form";
import { resendInvitation, revokeInvitation } from "./actions";

const ROLE_LABEL: Record<string, string> = {
  SUPERADMIN: "Superadmin",
  TENANT_ADMIN: "Tenant-admin",
  TENANT_MEMBER: "Lid",
};

const ROLE_TONE: Record<string, BadgeTone> = {
  SUPERADMIN: "danger",
  TENANT_ADMIN: "accent",
  TENANT_MEMBER: "neutral",
};

export const metadata = { title: "Gebruikers" };

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireSuperadmin();
  const sp = await searchParams;

  const [tenants, pendingInvites] = await Promise.all([
    prisma.tenant.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    listPendingInvitations(),
  ]);

  const users = await prisma.user.findMany({
    where: sp.q
      ? {
          OR: [
            { email: { contains: sp.q, mode: "insensitive" } },
            { name: { contains: sp.q, mode: "insensitive" } },
          ],
        }
      : {},
    orderBy: [{ role: "asc" }, { email: "asc" }],
    take: 200,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      active: true,
      tenant: { select: { id: true, name: true } },
    },
  });

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <SectionHeading
        title="Alle gebruikers"
        description="Elke gebruiker over alle tenants van het platform."
      />

      <Card className="flex flex-col gap-3 p-5">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">Gebruiker uitnodigen</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Kies een tenant en verstuur een uitnodiging. De link is 7 dagen geldig
            (in dev verschijnt 'ie in de server-console).
          </p>
        </div>
        <InviteUserForm tenants={tenants} />
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
          showTenant
          resendAction={resendInvitation}
          revokeAction={revokeInvitation}
        />
      </section>

      <form method="get" className="flex items-end gap-2">
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="zoek op e-mail of naam…"
          className="w-72 rounded-xl border border-border bg-surface-1 px-3.5 py-2.5 text-sm text-neutral-900 outline-none focus-ring focus:border-accent"
        />
        <button type="submit" className="rounded-xl bg-accent-gradient px-4 py-2.5 text-sm font-semibold text-accent-foreground shadow-sm hover:shadow-accent">
          Zoeken
        </button>
      </form>

      <TableWrap>
        <Table>
          <Thead>
            <tr>
              <Th>Gebruiker</Th>
              <Th>Rol</Th>
              <Th>Tenant</Th>
              <Th>Status</Th>
            </tr>
          </Thead>
          <Tbody>
            {users.map((u) => (
              <Tr key={u.id}>
                <Td>
                  <div className="flex items-center gap-3">
                    <Avatar name={u.name ?? u.email} status={u.active ? "online" : "offline"} />
                    <div>
                      <p className="font-medium text-neutral-900">{u.name ?? "—"}</p>
                      <p className="text-xs text-neutral-500">{u.email}</p>
                    </div>
                  </div>
                </Td>
                <Td>
                  <Badge tone={ROLE_TONE[u.role] ?? "neutral"}>{ROLE_LABEL[u.role]}</Badge>
                </Td>
                <Td className="text-neutral-500">
                  {u.tenant ? (
                    <Link href={`/admin/tenants/${u.tenant.id}`} className="text-accent hover:underline">
                      {u.tenant.name}
                    </Link>
                  ) : (
                    <span className="text-neutral-400">platform</span>
                  )}
                </Td>
                <Td>
                  {u.active ? (
                    <span className="text-green-600">actief</span>
                  ) : (
                    <span className="text-neutral-400">inactief</span>
                  )}
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </TableWrap>
    </div>
  );
}
