import Link from "next/link";
import type { DashboardStats } from "@/lib/insights";
import { formatRelative, formatSessionStart } from "@/lib/datetime";
import { getActionDef } from "@/lib/audit-actions";
import { StatCard } from "@/components/ui/stat-card";
import { SessionsBarChart } from "@/components/charts/sessions-bar-chart";
import { SessionsLineChart } from "@/components/charts/sessions-line-chart";
import { EmptyState } from "@/components/ui/empty-state";
import { Flame, Users, Dumbbell, UserPlus } from "@/components/ui/icons";
import type { AuditRowData } from "@/components/audit/types";

const iconCls = "size-4";

export function KpiRow({ stats }: { stats: DashboardStats }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard
        label="Actief vandaag"
        value={stats.activeToday}
        icon={<Flame className={iconCls} />}
        hint="leden getraind"
      />
      <StatCard
        label="Nieuwe leden (30d)"
        value={stats.newSignups}
        icon={<UserPlus className={iconCls} />}
        trend={stats.signupsTrend}
      />
      <StatCard
        label="Sessies (7d)"
        value={stats.sessionsThisWeek}
        icon={<Dumbbell className={iconCls} />}
        trend={stats.sessionsTrend}
      />
      <StatCard
        label="Leden totaal"
        value={stats.memberCount}
        icon={<Users className={iconCls} />}
        hint={`${stats.machineCount} machines`}
      />
    </div>
  );
}

export function PopularExercises({ stats }: { stats: DashboardStats }) {
  if (stats.popularExercises.length === 0) {
    return (
      <EmptyState
        icon={<Dumbbell className="size-6" />}
        title="Nog geen data"
        description="Populaire oefeningen verschijnen zodra leden trainen."
      />
    );
  }
  const max = Math.max(...stats.popularExercises.map((e) => e.count), 1);
  return (
    <ul className="flex flex-col gap-3">
      {stats.popularExercises.map((e, i) => (
        <li key={e.name} className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 font-medium text-neutral-900">
              <span className="flex size-5 items-center justify-center rounded-md bg-accent-soft text-[11px] font-bold text-accent">
                {i + 1}
              </span>
              {e.name}
            </span>
            <span className="text-neutral-500">{e.count}×</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-neutral-100">
            <div
              className="h-full rounded-full bg-accent-gradient"
              style={{ width: `${Math.max((e.count / max) * 100, 4)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ClassOccupancy({ stats }: { stats: DashboardStats }) {
  if (stats.classOccupancy.length === 0) {
    return (
      <EmptyState
        icon="📅"
        title="Geen geplande lessen"
        description="Plan lessen in het rooster om bezetting te zien."
      />
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {stats.classOccupancy.map((c, i) => {
        const pct = c.capacity > 0 ? Math.round((c.enrolled / c.capacity) * 100) : 0;
        const full = pct >= 90;
        return (
          <li key={i} className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-neutral-900">{c.name}</span>
              <span className={full ? "font-semibold text-accent" : "text-neutral-500"}>
                {c.enrolled}/{c.capacity}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-100">
                <div
                  className="h-full rounded-full bg-accent-gradient"
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
              <span className="w-20 shrink-0 text-right text-xs text-neutral-400">
                {formatSessionStart(new Date(c.startsAt))}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
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
