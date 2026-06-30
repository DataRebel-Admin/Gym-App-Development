"use client";

import { useState } from "react";
import { m } from "motion/react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { getActionDef, CATEGORY_META } from "@/lib/audit-actions";
import { cn } from "@/lib/cn";
import { AuditDiff } from "./audit-diff";
import type { AuditRowData } from "./types";

const DATE_FMT = new Intl.DateTimeFormat("nl-NL", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const toneDot: Record<BadgeTone, string> = {
  neutral: "bg-neutral-400",
  accent: "bg-accent",
  success: "bg-green-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
};

export function AuditList({
  rows,
  showTenant = false,
}: {
  rows: AuditRowData[];
  showTenant?: boolean;
}) {
  const [selected, setSelected] = useState<AuditRowData | null>(null);

  if (rows.length === 0) {
    return (
      <EmptyState
        icon="🗂️"
        title="Geen audit-regels"
        description="Er zijn geen gebeurtenissen die aan je filters voldoen."
      />
    );
  }

  return (
    <>
      <ol className="flex flex-col">
        {rows.map((row, i) => {
          const def = getActionDef(row.action);
          const failed = row.status === "FAILED";
          return (
            <m.li
              key={row.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, delay: Math.min(i * 0.015, 0.3) }}
            >
              <button
                type="button"
                onClick={() => setSelected(row)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-neutral-50",
                  i > 0 ? "border-t border-border" : ""
                )}
              >
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-full text-base",
                    failed ? "bg-red-50" : "bg-accent-soft"
                  )}
                >
                  {def.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-medium text-neutral-900">
                    <span className={cn("size-1.5 rounded-full", toneDot[def.tone])} />
                    {def.label}
                    {failed ? <Badge tone="danger">Mislukt</Badge> : null}
                  </p>
                  <p className="truncate text-xs text-neutral-500">
                    {row.actorEmail ?? "—"}
                    {row.targetType ? ` · ${row.targetType}` : ""}
                    {showTenant && row.tenantName ? ` · ${row.tenantName}` : ""}
                  </p>
                </div>
                <time className="shrink-0 text-xs text-neutral-400">
                  {DATE_FMT.format(new Date(row.createdAt))}
                </time>
              </button>
            </m.li>
          );
        })}
      </ol>

      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected ? getActionDef(selected.action).label : undefined}
        className="max-w-lg"
      >
        {selected ? <Detail row={selected} showTenant={showTenant} /> : null}
      </Modal>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-2 text-sm">
      <span className="text-neutral-500">{label}</span>
      <span className="break-words text-neutral-900">{value || "—"}</span>
    </div>
  );
}

function Detail({
  row,
  showTenant,
}: {
  row: AuditRowData;
  showTenant: boolean;
}) {
  const def = getActionDef(row.action);
  const cat = row.category ? CATEGORY_META[def.category] : null;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Row label="Tijdstip" value={DATE_FMT.format(new Date(row.createdAt))} />
        <Row
          label="Status"
          value={
            <Badge tone={row.status === "FAILED" ? "danger" : "success"}>
              {row.status === "FAILED" ? "Mislukt" : "Succes"}
            </Badge>
          }
        />
        <Row label="Actie" value={<code className="text-xs">{row.action}</code>} />
        <Row
          label="Categorie"
          value={cat ? <Badge tone={cat.tone}>{cat.label}</Badge> : row.category}
        />
        <Row label="Gebruiker" value={row.actorEmail} />
        <Row label="Rol" value={row.actorRole} />
        {showTenant ? (
          <Row label="Tenant" value={row.tenantName ?? row.tenantId ?? "platform"} />
        ) : null}
        <Row
          label="Object"
          value={
            row.targetType
              ? `${row.targetType}${row.targetId ? ` (${row.targetId})` : ""}`
              : "—"
          }
        />
        <Row label="IP" value={row.ipAddress} />
        <Row label="Device" value={row.userAgent} />
      </div>

      <AuditDiff oldValue={row.oldValue} newValue={row.newValue} />

      {row.metadata && Object.keys(row.metadata as object).length > 0 ? (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Metadata
          </p>
          <pre className="overflow-x-auto rounded-xl border border-border bg-surface-0 p-3 text-xs text-neutral-700">
            {JSON.stringify(row.metadata, null, 2)}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
