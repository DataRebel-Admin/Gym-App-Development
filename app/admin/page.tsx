import Link from "next/link";
import { requireSuperadmin } from "@/lib/superadmin";
import { getAdminDashboard, type AttentionItem } from "@/lib/admin-dashboard";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { AuditList } from "@/components/audit/audit-list";
import { TenantHealthTable } from "@/components/admin/dashboard/tenant-health-table";
import { cn } from "@/lib/cn";

export const metadata = { title: "Dashboard" };

const TIME_FMT = new Intl.DateTimeFormat("nl-NL", {
  hour: "2-digit",
  minute: "2-digit",
});

const ATTENTION_TONE: Record<
  AttentionItem["tone"],
  { card: string; icon: string; count: string }
> = {
  danger: {
    card: "border-red-200 bg-red-50/50",
    icon: "bg-red-100 text-red-600",
    count: "text-red-600",
  },
  warning: {
    card: "border-amber-200 bg-amber-50/50",
    icon: "bg-amber-100 text-amber-600",
    count: "text-amber-600",
  },
  accent: {
    card: "border-border bg-surface-1",
    icon: "bg-accent-soft text-accent",
    count: "text-neutral-900",
  },
};

function AttentionCard({ item }: { item: AttentionItem }) {
  const t = ATTENTION_TONE[item.tone];
  return (
    <Link
      href={item.href}
      className={cn(
        "group flex items-start gap-3 rounded-2xl border p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md",
        t.card
      )}
    >
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-xl text-lg",
          t.icon
        )}
      >
        {item.icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
          <span className={cn("tabular-nums", t.count)}>{item.count}</span>
          {item.title}
        </p>
        <p className="mt-0.5 text-xs text-neutral-500">{item.detail}</p>
      </div>
      <span
        className="mt-1 text-neutral-300 transition-transform group-hover:translate-x-0.5 group-hover:text-neutral-500"
        aria-hidden
      >
        →
      </span>
    </Link>
  );
}

function ActivityTrend({
  data,
}: {
  data: { label: string; count: number }[];
}) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const total = data.reduce((s, d) => s + d.count, 0);
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-neutral-900">
            Trainingen per week
          </h2>
          <span className="text-xs text-neutral-500">
            {total.toLocaleString("nl-NL")} in 8 weken
          </span>
        </div>
        <div className="flex h-28 items-end gap-1.5">
          {data.map((d, i) => (
            <div
              key={i}
              className="group flex flex-1 flex-col items-center justify-end gap-1"
              title={`${d.label}: ${d.count} trainingen`}
            >
              <span className="text-[10px] font-medium tabular-nums text-neutral-400 opacity-0 transition-opacity group-hover:opacity-100">
                {d.count}
              </span>
              <div
                className={cn(
                  "w-full rounded-t-md bg-accent-gradient transition-all",
                  i === data.length - 1 ? "opacity-100" : "opacity-70"
                )}
                style={{ height: `${Math.max(4, (d.count / max) * 100)}%` }}
              />
              <span className="text-[10px] text-neutral-400">{d.label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default async function AdminDashboard() {
  await requireSuperadmin();
  const data = await getAdminDashboard();
  const { kpis } = data;

  return (
    <div className="flex flex-col gap-8 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
            Platform-cockpit
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Bijgewerkt om {TIME_FMT.format(new Date(data.generatedAt))} ·{" "}
            {kpis.tenantsActive} actieve sportscholen ·{" "}
            {kpis.members.toLocaleString("nl-NL")} leden
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/tenants/new"
            className="rounded-lg bg-accent-gradient px-4 py-2 text-sm font-semibold text-accent-foreground shadow-sm hover:shadow-accent"
          >
            + Nieuwe tenant
          </Link>
          <Link
            href="/admin/tenants"
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
          >
            Tenants beheren
          </Link>
        </div>
      </div>

      {/* KPI's met trend */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label="Actieve tenants"
          value={kpis.tenantsActive}
          suffix={`/${kpis.tenantsTotal}`}
          hint={`${kpis.newTenants30} nieuw (30d)`}
          trend={kpis.newTenantsTrend}
        />
        <StatCard
          label="Leden"
          value={kpis.members}
          hint={`${kpis.newMembers30} nieuw (30d)`}
          trend={kpis.newMembersTrend}
        />
        <StatCard
          label="Trainingen (7d)"
          value={kpis.sessions7}
          hint="vs. vorige week"
          trend={kpis.sessionsTrend}
        />
        <StatCard
          label="Team"
          value={kpis.admins + kpis.staff}
          hint={`${kpis.admins} admins · ${kpis.staff} coaches`}
        />
      </div>

      {/* Vraagt om aandacht */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-neutral-900">
          Vraagt om aandacht
        </h2>
        {data.attention.length === 0 ? (
          <Card>
            <CardContent className="flex items-center gap-3 text-sm text-neutral-600">
              <span className="text-xl">✅</span>
              Alles onder controle — geen openstaande signalen.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {data.attention.map((item) => (
              <AttentionCard key={item.key} item={item} />
            ))}
          </div>
        )}
      </section>

      {/* Trend + recente activiteit */}
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <ActivityTrend data={data.weeklySessions} />
        <Card>
          <CardContent className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-neutral-900">
                Recente platformactiviteit
              </h2>
              <Link
                href="/admin/audit"
                className="text-xs text-neutral-500 hover:text-neutral-900"
              >
                Alles →
              </Link>
            </div>
            <AuditList rows={data.recentAudit} showTenant />
          </CardContent>
        </Card>
      </div>

      {/* Tenant-gezondheid */}
      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-neutral-900">
            Tenant-gezondheid
          </h2>
          <Link
            href="/admin/tenants"
            className="text-xs text-neutral-500 hover:text-neutral-900"
          >
            Alle tenants →
          </Link>
        </div>
        <TenantHealthTable rows={data.tenants} />
      </section>
    </div>
  );
}
