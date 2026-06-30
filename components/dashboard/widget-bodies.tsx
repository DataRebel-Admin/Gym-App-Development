import Link from "next/link";
import type { DashboardStats } from "@/lib/insights";
import { formatRelative } from "@/lib/datetime";
import { getActionDef } from "@/lib/audit-actions";
import { StatCard } from "@/components/ui/stat-card";
import { SessionsBarChart } from "@/components/charts/sessions-bar-chart";
import { SessionsLineChart } from "@/components/charts/sessions-line-chart";
import { EmptyState } from "@/components/ui/empty-state";
import type { AuditRowData } from "@/components/audit/types";

export function KpiRow({ stats }: { stats: DashboardStats }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard label="Actief vandaag" value={stats.activeToday} icon="🔥" />
      <StatCard label="Leden" value={stats.memberCount} icon="👥" />
      <StatCard
        label="Sessies (7d)"
        value={stats.sessionsThisWeek}
        icon="💪"
      />
      <StatCard label="Machines" value={stats.machineCount} icon="🏋️" />
    </div>
  );
}

export function UsageList({
  items,
}: {
  items: { name: string; sessions: number }[];
}) {
  if (items.length === 0) {
    return <p className="text-sm text-neutral-500">Nog geen gebruik.</p>;
  }
  const max = Math.max(...items.map((i) => i.sessions), 1);
  return (
    <ul className="flex flex-col gap-3">
      {items.map((m) => (
        <li key={m.name} className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-neutral-900">{m.name}</span>
            <span className="text-neutral-500">{m.sessions} sessies</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-neutral-100">
            <div
              className="h-full rounded-full bg-accent-gradient"
              style={{ width: `${Math.max((m.sessions / max) * 100, 4)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function WeekdayChart({ stats }: { stats: DashboardStats }) {
  return <SessionsBarChart data={stats.perWeekday} />;
}

export function WeekChart({ stats }: { stats: DashboardStats }) {
  return <SessionsLineChart data={stats.perWeek} />;
}

/** Leesbare activiteitenfeed op basis van de auditlog. */
export function RecentActivity({ rows }: { rows: AuditRowData[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon="🕓"
        title="Nog geen activiteit"
        description="Beheeracties verschijnen hier zodra ze plaatsvinden."
      />
    );
  }
  return (
    <div className="flex flex-col">
      <ul className="flex flex-col">
        {rows.map((r, i) => {
          const def = getActionDef(r.action);
          const actor =
            r.actorEmail?.split("@")[0] ?? "Iemand";
          const meta = (r.metadata ?? {}) as Record<string, unknown>;
          return (
            <li
              key={r.id}
              className={`flex items-center gap-3 py-2.5 ${
                i > 0 ? "border-t border-border" : ""
              }`}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-base">
                {def.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-neutral-900">
                  {def.sentence({ actor, meta, target: r.targetId })}
                </p>
                <p className="text-xs text-neutral-500">
                  {formatRelative(new Date(r.createdAt))}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
      <Link
        href="/owner/audit"
        className="mt-2 text-sm font-medium text-accent hover:underline"
      >
        Alle activiteit →
      </Link>
    </div>
  );
}

const QUICK_LINKS = [
  { href: "/owner/machines/new", label: "Machine toevoegen", icon: "➕" },
  { href: "/owner/exercises", label: "Oefeningen", icon: "🏋️" },
  { href: "/owner/schemas", label: "Schema's", icon: "📋" },
  { href: "/owner/members", label: "Leden", icon: "👥" },
  { href: "/owner/rooster", label: "Rooster", icon: "📅" },
  { href: "/owner/insights", label: "Inzichten", icon: "📊" },
];

export function QuickActions() {
  return (
    <div className="grid grid-cols-2 gap-2">
      {QUICK_LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className="flex items-center gap-2 rounded-xl border border-border bg-surface-1 px-3 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:border-accent hover:bg-accent-soft hover:text-neutral-900"
        >
          <span aria-hidden>{l.icon}</span>
          {l.label}
        </Link>
      ))}
    </div>
  );
}
