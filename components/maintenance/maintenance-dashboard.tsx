"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { StatCard } from "@/components/ui/stat-card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Button } from "@/components/ui/button";
import { machineTypeLabel, MACHINE_TYPES, MACHINE_TYPE_LABELS } from "@/lib/machine";
import {
  fmtDate,
  fmtCost,
  MAINTENANCE_KIND_META,
  type MaintenanceLevel,
} from "@/lib/maintenance";
import type {
  MaintenanceMachineRow,
  MaintenanceRecordRow,
} from "@/lib/maintenance-eval";
import { MachineStatusBadge } from "./status-badge";
import { LogMaintenanceDialog } from "./log-maintenance-dialog";
import { MaintenanceCalendar, type CalendarItem } from "./maintenance-calendar";
import { setMachineStatus } from "@/app/owner/maintenance/actions";

type StatusFilter = "all" | "due" | "soon" | "active" | "IN_MAINTENANCE" | "OUT_OF_SERVICE";

const PRIORITY: Record<string, number> = {
  MAINTENANCE_DUE: 0,
  soon: 1,
  IN_MAINTENANCE: 2,
  OUT_OF_SERVICE: 3,
  ACTIVE: 4,
};

function machineRank(m: MaintenanceMachineRow): number {
  if (m.effectiveStatus === "ACTIVE" && m.level === "soon") return PRIORITY.soon;
  return PRIORITY[m.effectiveStatus] ?? 5;
}

const inputClass =
  "rounded-lg border border-border bg-surface-1 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-accent";

export function MaintenanceDashboard({
  machines,
  records,
  counts,
  basePath = "/owner/machines",
}: {
  machines: MaintenanceMachineRow[];
  records: MaintenanceRecordRow[];
  counts: { due: number; soon: number; inMaintenance: number; outOfService: number; active: number };
  basePath?: string;
}) {
  const t = useTranslations("maintenance");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [type, setType] = useState<string>("all");
  const [location, setLocation] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [logMachine, setLogMachine] = useState<MaintenanceMachineRow | null>(null);

  const locations = useMemo(
    () => [...new Set(machines.map((m) => m.location).filter((l): l is string => Boolean(l)))].sort(),
    [machines]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return machines
      .filter((m) => {
        if (type !== "all" && m.type !== type) return false;
        if (location !== "all" && m.location !== location) return false;
        if (q && !`${m.name} ${m.serialNumber ?? ""} ${m.location ?? ""}`.toLowerCase().includes(q)) {
          return false;
        }
        if (status === "all") return true;
        if (status === "due") return m.effectiveStatus === "MAINTENANCE_DUE";
        if (status === "soon") return m.effectiveStatus === "ACTIVE" && m.level === "soon";
        if (status === "active") return m.effectiveStatus === "ACTIVE" && m.level !== "soon";
        return m.effectiveStatus === status;
      })
      .sort((a, b) => machineRank(a) - machineRank(b) || a.name.localeCompare(b.name));
  }, [machines, status, type, location, query]);

  const calendarItems: CalendarItem[] = useMemo(
    () =>
      machines
        .filter((m) => m.nextMaintenanceAt)
        .map((m) => ({
          date: m.nextMaintenanceAt as string,
          name: m.name,
          overdue: (m.daysUntilDue ?? 1) <= 0,
        })),
    [machines]
  );

  const statCards: { key: StatusFilter; label: string; value: number; icon: string }[] = [
    { key: "due", label: t("dashboard.cardDue"), value: counts.due, icon: "🔧" },
    { key: "soon", label: t("dashboard.cardSoon"), value: counts.soon, icon: "🕒" },
    { key: "IN_MAINTENANCE", label: t("dashboard.cardInMaintenance"), value: counts.inMaintenance, icon: "🛠️" },
    { key: "OUT_OF_SERVICE", label: t("dashboard.cardOutOfService"), value: counts.outOfService, icon: "⛔" },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Samenvattingskaarten — klikbaar als filter */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {statCards.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setStatus((s) => (s === c.key ? "all" : c.key))}
            className={cn(
              "text-left transition-transform hover:-translate-y-0.5",
              status === c.key && "ring-2 ring-accent rounded-2xl"
            )}
          >
            <StatCard label={c.label} value={c.value} icon={<span>{c.icon}</span>} />
          </button>
        ))}
      </div>

      {/* Filterbalk */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("dashboard.searchPlaceholder")}
          className={cn(inputClass, "min-w-[16rem] flex-1")}
        />
        <select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} className={inputClass}>
          <option value="all">{t("dashboard.filterAllStatuses")}</option>
          <option value="due">{t("dashboard.filterDue")}</option>
          <option value="soon">{t("dashboard.filterSoon")}</option>
          <option value="active">{t("dashboard.filterActive")}</option>
          <option value="IN_MAINTENANCE">{t("dashboard.filterInMaintenance")}</option>
          <option value="OUT_OF_SERVICE">{t("dashboard.filterOutOfService")}</option>
        </select>
        <select value={type} onChange={(e) => setType(e.target.value)} className={inputClass}>
          <option value="all">{t("dashboard.filterAllTypes")}</option>
          {MACHINE_TYPES.map((mt) => (
            <option key={mt} value={mt}>
              {MACHINE_TYPE_LABELS[mt]}
            </option>
          ))}
        </select>
        {locations.length ? (
          <select value={location} onChange={(e) => setLocation(e.target.value)} className={inputClass}>
            <option value="all">{t("dashboard.filterAllLocations")}</option>
            {locations.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {/* Machinekaarten */}
      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-neutral-500">
          {t("dashboard.noMachines")}
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((m) => (
            <MachineCard
              key={m.id}
              machine={m}
              basePath={basePath}
              onLog={() => setLogMachine(m)}
            />
          ))}
        </div>
      )}

      {/* Kalender */}
      <MaintenanceCalendar items={calendarItems} />

      {/* Historie */}
      <MaintenanceHistory records={records} />

      {logMachine ? (
        <LogMaintenanceDialog
          open
          onClose={() => setLogMachine(null)}
          machineId={logMachine.id}
          machineName={logMachine.name}
          currentIntervalDays={logMachine.maintenanceIntervalDays}
        />
      ) : null}
    </div>
  );
}

function StatusForm({
  machineId,
  status,
  label,
  variant = "outline",
}: {
  machineId: string;
  status: "ACTIVE" | "IN_MAINTENANCE" | "OUT_OF_SERVICE";
  label: string;
  variant?: "outline" | "ghost" | "danger";
}) {
  return (
    <form action={setMachineStatus}>
      <input type="hidden" name="machineId" value={machineId} />
      <input type="hidden" name="status" value={status} />
      <Button type="submit" variant={variant} size="sm">
        {label}
      </Button>
    </form>
  );
}

function MachineCard({
  machine: m,
  basePath,
  onLog,
}: {
  machine: MaintenanceMachineRow;
  basePath: string;
  onLog: () => void;
}) {
  const t = useTranslations("maintenance");
  const ratio = m.usageThreshold ? Math.min(100, Math.round((m.usageRatio ?? 0) * 100)) : null;
  const level: MaintenanceLevel = m.level;
  const accentBorder =
    m.effectiveStatus === "MAINTENANCE_DUE"
      ? "border-red-200"
      : level === "soon"
        ? "border-amber-200"
        : "border-border";

  return (
    <div className={cn("flex flex-col gap-3 rounded-2xl border bg-surface-1 p-4 shadow-sm", accentBorder)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link href={`${basePath}/${m.id}`} className="block truncate font-semibold text-neutral-900 hover:text-accent">
            {m.name}
          </Link>
          <p className="text-xs text-neutral-500">
            {machineTypeLabel(m.type)}
            {m.location ? ` · ${m.location}` : ""}
            {m.serialNumber ? ` · ${m.serialNumber}` : ""}
          </p>
        </div>
        <MachineStatusBadge status={m.effectiveStatus} level={m.level} />
      </div>

      {ratio != null ? (
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-xs text-neutral-500">
            <span>{t("dashboard.usageSince")}</span>
            <span className="tabular-nums">
              {m.usageCount} / {m.usageThreshold}
            </span>
          </div>
          <ProgressBar value={ratio} className={m.effectiveStatus === "MAINTENANCE_DUE" ? "bg-red-500" : ""} />
        </div>
      ) : (
        <p className="text-xs text-neutral-400">{t("dashboard.usageNoLimit", { count: m.usageCount })}</p>
      )}

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500">
        <span>{t("dashboard.last", { date: fmtDate(m.lastMaintenanceAt) })}</span>
        <span>
          {t("dashboard.next", { date: fmtDate(m.nextMaintenanceAt) })}
          {m.daysUntilDue != null
            ? m.daysUntilDue <= 0
              ? ` ${t("due.overdue", { days: Math.abs(m.daysUntilDue) })}`
              : ` ${t("due.in", { days: m.daysUntilDue })}`
            : ""}
        </span>
      </div>

      {m.reasons.length ? (
        <div className="flex flex-wrap gap-1">
          {m.reasons.map((r, i) => (
            <span
              key={i}
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-medium",
                m.effectiveStatus === "MAINTENANCE_DUE"
                  ? "bg-red-100 text-red-700"
                  : "bg-amber-100 text-amber-700"
              )}
            >
              {r}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-auto flex flex-wrap gap-2 pt-1">
        <Button type="button" size="sm" onClick={onLog}>
          {t("dashboard.logButton")}
        </Button>
        {m.status === "OUT_OF_SERVICE" || m.status === "IN_MAINTENANCE" ? (
          <StatusForm machineId={m.id} status="ACTIVE" label={t("status.reactivate")} />
        ) : (
          <>
            <StatusForm machineId={m.id} status="IN_MAINTENANCE" label={t("status.inMaintenance")} />
            <StatusForm machineId={m.id} status="OUT_OF_SERVICE" label={t("status.outOfService")} variant="ghost" />
          </>
        )}
      </div>
    </div>
  );
}

function MaintenanceHistory({ records }: { records: MaintenanceRecordRow[] }) {
  const t = useTranslations("maintenance");
  const [query, setQuery] = useState("");
  const [responsible, setResponsible] = useState("all");
  const [from, setFrom] = useState("");

  const responsibles = useMemo(
    () => [...new Set(records.map((r) => r.performedBy).filter((r): r is string => Boolean(r)))].sort(),
    [records]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const fromTs = from ? new Date(from).getTime() : null;
    return records.filter((r) => {
      if (responsible !== "all" && r.performedBy !== responsible) return false;
      if (fromTs && new Date(r.performedAt).getTime() < fromTs) return false;
      if (q && !`${r.machineName} ${r.action}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [records, query, responsible, from]);

  return (
    <div className="rounded-2xl border border-border bg-surface-1 p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-neutral-900">{t("dashboard.history.title")}</h3>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("dashboard.history.searchPlaceholder")}
            className={cn(inputClass, "py-1.5")}
          />
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={cn(inputClass, "py-1.5")} />
          <select value={responsible} onChange={(e) => setResponsible(e.target.value)} className={cn(inputClass, "py-1.5")}>
            <option value="all">{t("dashboard.history.everyone")}</option>
            {responsibles.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="py-6 text-center text-sm text-neutral-500">{t("dashboard.history.empty")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-neutral-400">
                <th className="py-2 pr-4 font-medium">{t("dashboard.history.colDate")}</th>
                <th className="py-2 pr-4 font-medium">{t("dashboard.history.colMachine")}</th>
                <th className="py-2 pr-4 font-medium">{t("dashboard.history.colKind")}</th>
                <th className="py-2 pr-4 font-medium">{t("dashboard.history.colAction")}</th>
                <th className="py-2 pr-4 font-medium">{t("dashboard.history.colPerformedBy")}</th>
                <th className="py-2 pr-0 text-right font-medium">{t("dashboard.history.colCost")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-border/60 last:border-0">
                  <td className="py-2 pr-4 whitespace-nowrap text-neutral-600">{fmtDate(r.performedAt)}</td>
                  <td className="py-2 pr-4 font-medium text-neutral-900">{r.machineName}</td>
                  <td className="py-2 pr-4 text-neutral-600">
                    {MAINTENANCE_KIND_META[r.kind].icon} {MAINTENANCE_KIND_META[r.kind].label}
                  </td>
                  <td className="py-2 pr-4 text-neutral-600">
                    {r.action}
                    {r.note ? <span className="block text-xs text-neutral-400">{r.note}</span> : null}
                  </td>
                  <td className="py-2 pr-4 text-neutral-600">{r.performedBy ?? "—"}</td>
                  <td className="py-2 pr-0 text-right tabular-nums text-neutral-600">{fmtCost(r.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
