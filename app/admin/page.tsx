import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSuperadmin } from "@/lib/superadmin";

const DATE_FMT = new Intl.DateTimeFormat("nl-NL", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-neutral-200 p-5">
      <p className="text-sm text-neutral-500">{label}</p>
      <p className="mt-1 text-3xl font-semibold text-neutral-900">{value}</p>
    </div>
  );
}

export const metadata = { title: "Dashboard" };

export default async function AdminDashboard() {
  await requireSuperadmin();

  const [tenantsTotal, tenantsActive, usersByRole, recentAudit] =
    await Promise.all([
      prisma.tenant.count({ where: { deletedAt: null } }),
      prisma.tenant.count({ where: { deletedAt: null, status: "ACTIVE" } }),
      prisma.user.groupBy({ by: ["role"], _count: true }),
      prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
    ]);

  const roleCount = (r: string) =>
    usersByRole.find((g) => g.role === r)?._count ?? 0;

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
        Platform-dashboard
      </h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Tenants (actief)" value={`${tenantsActive}/${tenantsTotal}`} />
        <Stat label="Tenant-admins" value={roleCount("TENANT_ADMIN")} />
        <Stat label="Leden" value={roleCount("TENANT_MEMBER")} />
        <Stat label="Superadmins" value={roleCount("SUPERADMIN")} />
      </div>

      <div className="flex gap-3">
        <Link
          href="/admin/tenants"
          className="rounded-lg bg-accent-gradient px-4 py-2 text-sm font-semibold text-accent-foreground shadow-sm hover:shadow-accent"
        >
          Tenants beheren
        </Link>
        <Link
          href="/admin/tenants/new"
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
        >
          + Nieuwe tenant
        </Link>
      </div>

      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-neutral-900">
            Recente beheertaken
          </h2>
          <Link href="/admin/audit" className="text-sm text-neutral-500 hover:text-neutral-900">
            Alles bekijken →
          </Link>
        </div>
        {recentAudit.length === 0 ? (
          <p className="text-sm text-neutral-500">Nog geen audit-regels.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-neutral-100 rounded-xl border border-neutral-200">
            {recentAudit.map((a) => (
              <li key={a.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="font-mono text-xs text-neutral-700">{a.action}</span>
                <span className="text-neutral-500">
                  {a.actorEmail ?? "—"} · {DATE_FMT.format(a.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
