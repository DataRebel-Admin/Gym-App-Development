import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSuperadmin } from "@/lib/superadmin";

const ROLE_LABEL: Record<string, string> = {
  SUPERADMIN: "Superadmin",
  TENANT_ADMIN: "Tenant-admin",
  TENANT_MEMBER: "Lid",
};

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireSuperadmin();
  const sp = await searchParams;

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
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
        Alle gebruikers
      </h1>

      <form method="get" className="flex items-end gap-2">
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="zoek op e-mail of naam…"
          className="w-72 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
          Zoeken
        </button>
      </form>

      <div className="overflow-hidden rounded-xl border border-neutral-200">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-medium">E-mail</th>
              <th className="px-4 py-3 font-medium">Naam</th>
              <th className="px-4 py-3 font-medium">Rol</th>
              <th className="px-4 py-3 font-medium">Tenant</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-neutral-50">
                <td className="px-4 py-2.5 text-neutral-800">{u.email}</td>
                <td className="px-4 py-2.5 text-neutral-700">{u.name ?? "—"}</td>
                <td className="px-4 py-2.5 text-neutral-600">{ROLE_LABEL[u.role]}</td>
                <td className="px-4 py-2.5 text-neutral-600">
                  {u.tenant ? (
                    <Link href={`/admin/tenants/${u.tenant.id}`} className="hover:underline">
                      {u.tenant.name}
                    </Link>
                  ) : (
                    <span className="text-neutral-400">platform</span>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  {u.active ? (
                    <span className="text-green-600">actief</span>
                  ) : (
                    <span className="text-neutral-400">inactief</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
