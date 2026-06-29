import Link from "next/link";
import { requireOwner } from "@/lib/owner";
import { getDashboardStats } from "@/lib/insights";
import { SessionsBarChart } from "@/components/charts/sessions-bar-chart";
import { SessionsLineChart } from "@/components/charts/sessions-line-chart";

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-neutral-200 p-5">
      <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
      {children}
    </section>
  );
}

function UsageList({
  items,
}: {
  items: { name: string; sessions: number }[];
}) {
  if (items.length === 0) {
    return <p className="text-sm text-neutral-500">Nog geen gebruik.</p>;
  }
  return (
    <ul className="flex flex-col gap-1.5 text-sm">
      {items.map((m) => (
        <li key={m.name} className="flex justify-between">
          <span className="text-neutral-900">{m.name}</span>
          <span className="text-neutral-500">{m.sessions} sessies</span>
        </li>
      ))}
    </ul>
  );
}

export default async function OwnerDashboard() {
  const owner = await requireOwner();
  const stats = await getDashboardStats(owner.tenantId);

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
          Dashboard
        </h1>
        <Link
          href="/owner/insights"
          className="text-sm text-accent hover:underline"
        >
          Diepere inzichten →
        </Link>
      </div>

      <section className="rounded-xl border border-neutral-200 p-5">
        <p className="text-sm text-neutral-500">Actieve leden vandaag</p>
        <p className="mt-1 text-3xl font-semibold text-neutral-900">
          {stats.activeToday}
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Top 5 machines (deze week)">
          <UsageList items={stats.topMachines} />
        </Panel>
        <Panel title="Minst gebruikt (deze maand)">
          <UsageList items={stats.bottomMachines} />
        </Panel>
      </div>

      <Panel title="Sessies per weekdag (laatste 30 dagen)">
        <SessionsBarChart data={stats.perWeekday} />
      </Panel>

      <Panel title="Sessies per week (laatste 12 weken)">
        <SessionsLineChart data={stats.perWeek} />
      </Panel>
    </div>
  );
}
