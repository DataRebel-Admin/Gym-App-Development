"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import type { MachineStatus } from "@prisma/client";
import { cn } from "@/lib/cn";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Button } from "@/components/ui/button";
import {
  fmtDate,
  fmtCost,
  INTERVAL_PRESETS,
  MAINTENANCE_KIND_META,
  type MaintenanceLevel,
} from "@/lib/maintenance";
import type { MaintenanceRecordRow } from "@/lib/maintenance-eval";
import { MachineStatusBadge } from "./status-badge";
import { LogMaintenanceDialog } from "./log-maintenance-dialog";
import {
  saveMaintenanceRules,
  setMachineStatus,
  adjustUsage,
  type MaintenanceActionState,
} from "@/app/owner/maintenance/actions";

type PanelMachine = {
  id: string;
  name: string;
  status: MachineStatus;
  effectiveStatus: MachineStatus;
  level: MaintenanceLevel;
  usageCount: number;
  usageThreshold: number | null;
  maintenanceIntervalDays: number | null;
  lastMaintenanceAt: string | null;
  nextMaintenanceAt: string | null;
  daysUntilDue: number | null;
  usageRatio: number | null;
  reasons: string[];
};

const inputClass =
  "rounded-lg border border-border bg-surface-1 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-accent";

export function MachineMaintenancePanel({
  machine: m,
  records,
}: {
  machine: PanelMachine;
  records: MaintenanceRecordRow[];
}) {
  const t = useTranslations("maintenance");
  const [logOpen, setLogOpen] = useState(false);
  const [rulesState, rulesAction, rulesPending] = useActionState<MaintenanceActionState, FormData>(
    saveMaintenanceRules,
    {}
  );

  const ratio = m.usageThreshold ? Math.min(100, Math.round((m.usageRatio ?? 0) * 100)) : null;

  return (
    <section className="flex max-w-2xl flex-col gap-5 rounded-xl border border-border p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-neutral-900">{t("panel.title")}</h2>
        <MachineStatusBadge status={m.effectiveStatus} level={m.level} />
      </div>

      {/* Gebruik + volgende datum */}
      <div className="flex flex-col gap-2">
        {ratio != null ? (
          <>
            <div className="flex justify-between text-xs text-neutral-500">
              <span>{t("panel.usageSinceLast")}</span>
              <span className="tabular-nums">
                {m.usageCount} / {m.usageThreshold}
              </span>
            </div>
            <ProgressBar value={ratio} className={m.effectiveStatus === "MAINTENANCE_DUE" ? "bg-red-500" : ""} />
          </>
        ) : (
          <p className="text-xs text-neutral-500">{t("panel.usageSince", { count: m.usageCount })}</p>
        )}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500">
          <span>{t("panel.lastMaintenance", { date: fmtDate(m.lastMaintenanceAt) })}</span>
          <span>
            {t("panel.next", { date: fmtDate(m.nextMaintenanceAt) })}
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
                  m.effectiveStatus === "MAINTENANCE_DUE" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                )}
              >
                {r}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {/* Snelle acties */}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={() => setLogOpen(true)}>
          {t("panel.logButton")}
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

      {/* Regels */}
      <form action={rulesAction} className="flex flex-col gap-3 rounded-lg bg-surface-2 p-4">
        <input type="hidden" name="machineId" value={m.id} />
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{t("panel.rulesTitle")}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm text-neutral-700">
            {t("panel.usageLimit")}
            <input
              name="usageThreshold"
              type="number"
              min={0}
              defaultValue={m.usageThreshold ?? ""}
              className={inputClass}
              placeholder={t("panel.usageLimitPlaceholder")}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-neutral-700">
            {t("panel.intervalDays")}
            <input
              name="intervalDays"
              type="number"
              min={0}
              defaultValue={m.maintenanceIntervalDays ?? ""}
              className={inputClass}
              placeholder={t("panel.intervalDaysPlaceholder")}
              list="detail-interval-presets"
            />
            <datalist id="detail-interval-presets">
              {INTERVAL_PRESETS.map((p) => (
                <option key={p.days} value={p.days}>
                  {p.label}
                </option>
              ))}
            </datalist>
          </label>
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" variant="outline" loading={rulesPending}>
            {t("panel.saveRules")}
          </Button>
          {rulesState.ok ? <span className="text-xs text-green-600">{t("panel.saved")}</span> : null}
          {rulesState.error ? <span className="text-xs text-red-600">{rulesState.error}</span> : null}
        </div>
      </form>

      {/* Teller handmatig aanpassen */}
      <form action={adjustUsage} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="machineId" value={m.id} />
        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          {t("panel.adjustCounter")}
          <input name="usageCount" type="number" min={0} defaultValue={m.usageCount} className={inputClass} />
        </label>
        <Button type="submit" size="sm" variant="ghost">
          {t("panel.update")}
        </Button>
      </form>

      {/* Historie van deze machine */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">{t("panel.history")}</p>
        {records.length === 0 ? (
          <p className="text-sm text-neutral-500">{t("panel.noHistory")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {records.map((r) => (
              <li key={r.id} className="rounded-lg border border-border/60 p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-neutral-900">
                    {MAINTENANCE_KIND_META[r.kind].icon} {r.action}
                  </span>
                  <span className="whitespace-nowrap text-xs text-neutral-400">{fmtDate(r.performedAt)}</span>
                </div>
                <div className="mt-0.5 text-xs text-neutral-500">
                  {r.performedBy ? `${r.performedBy} · ` : ""}
                  {fmtCost(r.cost) !== "—" ? `${fmtCost(r.cost)} · ` : ""}
                  {t("panel.counterWas", { count: r.usageAtService })}
                </div>
                {r.note ? <p className="mt-1 text-xs text-neutral-500">{r.note}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <LogMaintenanceDialog
        open={logOpen}
        onClose={() => setLogOpen(false)}
        machineId={m.id}
        machineName={m.name}
        currentIntervalDays={m.maintenanceIntervalDays}
      />
    </section>
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
