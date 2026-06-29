import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSuperadmin } from "@/lib/superadmin";

export default async function TenantsPage() {
  await requireSuperadmin();

  const tenants = await prisma.tenant.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    select: {
      id: true,
      slug: true,
      name: true,
      status: true,
      accentColor: true,
      _count: { select: { users: true } },
    },
  });

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
          Tenants
        </h1>
        <Link
          href="/admin/tenants/new"
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          + Nieuwe tenant
        </Link>
      </div>

      {tenants.length === 0 ? (
        <p className="text-sm text-neutral-500">Nog geen tenants.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-neutral-200">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-medium">Naam</th>
                <th className="px-4 py-3 font-medium">Slug</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Gebruikers</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {tenants.map((t) => (
                <tr key={t.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block h-3 w-3 rounded-full"
                        style={{ backgroundColor: t.accentColor ?? "#d4d4d4" }}
                      />
                      <span className="font-medium text-neutral-900">{t.name}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-neutral-500">{t.slug}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        t.status === "ACTIVE"
                          ? "bg-green-100 text-green-700"
                          : "bg-neutral-200 text-neutral-600"
                      }`}
                    >
                      {t.status === "ACTIVE" ? "Actief" : "Inactief"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-neutral-700">{t._count.users}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/tenants/${t.id}`}
                      className="text-sm font-medium text-neutral-900 hover:underline"
                    >
                      Beheren →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
