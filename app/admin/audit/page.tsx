import { prisma } from "@/lib/db";
import { requireSuperadmin } from "@/lib/superadmin";

const PAGE_SIZE = 50;

const DATE_FMT = new Intl.DateTimeFormat("nl-NL", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; page?: string }>;
}) {
  await requireSuperadmin();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? "1") || 1);

  const where = sp.action ? { action: { startsWith: sp.action } } : {};
  const [logs, total, tenants] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.auditLog.count({ where }),
    prisma.tenant.findMany({ select: { id: true, name: true } }),
  ]);
  const tenantName = new Map(tenants.map((t) => [t.id, t.name]));
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
        Audit log
      </h1>

      <form method="get" className="flex items-end gap-2">
        <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
          Filter op actie (prefix)
          <input
            name="action"
            defaultValue={sp.action ?? ""}
            placeholder="tenant. / user. / branding."
            className="w-64 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
        </label>
        <button type="submit" className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
          Filter
        </button>
      </form>

      <div className="overflow-hidden rounded-xl border border-neutral-200">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-medium">Tijdstip</th>
              <th className="px-4 py-3 font-medium">Actie</th>
              <th className="px-4 py-3 font-medium">Actor</th>
              <th className="px-4 py-3 font-medium">Tenant</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {logs.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-neutral-500">
                  Geen audit-regels.
                </td>
              </tr>
            ) : (
              logs.map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-2.5 whitespace-nowrap text-neutral-500">
                    {DATE_FMT.format(l.createdAt)}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-neutral-800">{l.action}</td>
                  <td className="px-4 py-2.5 text-neutral-700">{l.actorEmail ?? "—"}</td>
                  <td className="px-4 py-2.5 text-neutral-500">
                    {l.tenantId ? (tenantName.get(l.tenantId) ?? l.tenantId) : "platform"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <p className="text-sm text-neutral-500">
          Pagina {page} / {totalPages} · {total} regels
        </p>
      ) : null}
    </div>
  );
}
