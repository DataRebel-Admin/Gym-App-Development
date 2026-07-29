"use client";

import { useActionState, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { DefectSeverity, DefectStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Select, Textarea } from "@/components/ui/field";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Table, TableWrap, Thead, Tbody, Th, Tr, Td } from "@/components/ui/table";
import { AlertTriangle, Camera, Search } from "@/components/ui/icons";
import {
  DEFECT_STATUS_META,
  DEFECT_SEVERITY_META,
  defectAgeLabel,
  isOpenDefectStatus,
} from "@/lib/defects";
import {
  acknowledgeDefect,
  assignDefect,
  startRepair,
  resolveDefect,
  rejectDefect,
  mergeDefect,
  saveInternalNote,
  deleteDefect,
  type DefectActionState,
} from "@/app/owner/defects/actions";

export type DefectRow = {
  id: string;
  machineId: string | null;
  machineName: string;
  machineStatus: string | null;
  locationId: string;
  locationName: string;
  status: DefectStatus;
  severity: DefectSeverity;
  symptom: string;
  description: string | null;
  photoCount: number;
  /** Naam van de melder; null = anoniem. */
  reporter: string | null;
  assignedToId: string | null;
  assignedToName: string | null;
  confirmations: number;
  internalNote: string | null;
  resolutionNote: string | null;
  createdAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  duplicateOfId: string | null;
};

export type StaffOption = { id: string; name: string };
export type LocationOption = { id: string; name: string };
export type MostReportedRow = { machineId: string; name: string; count: number };

type StatusFilter = "open" | DefectStatus | "all";
type PeriodFilter = "7" | "30" | "90" | "all";

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("nl-NL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Defecten-dashboard voor trainers/beheer: open meldingen gesorteerd op ernst →
 * leeftijd (UNSAFE bovenaan, rood), filters, detail met foto's/tijdlijn/acties
 * en het blok "vaakst gemeld" (vervangingsvraag).
 */
export function DefectsDashboard({
  rows,
  staff,
  locations,
  mostReported,
  isAdmin,
}: {
  rows: DefectRow[];
  staff: StaffOption[];
  locations: LocationOption[];
  mostReported: MostReportedRow[];
  isAdmin: boolean;
}) {
  const t = useTranslations("defects");
  const to = useTranslations("owner.defects");

  const [status, setStatus] = useState<StatusFilter>("open");
  const [severity, setSeverity] = useState<DefectSeverity | "all">("all");
  const [machineId, setMachineId] = useState<string>("all");
  const [locationId, setLocationId] = useState<string>("all");
  const [period, setPeriod] = useState<PeriodFilter>("all");
  const [outOnly, setOutOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);

  const machines = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) if (r.machineId) map.set(r.machineId, r.machineName);
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const filtered = useMemo(() => {
    const since =
      period === "all" ? null : Date.now() - Number(period) * 86_400_000;
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (status === "open" ? !isOpenDefectStatus(r.status) : status !== "all" && r.status !== status) return false;
      if (severity !== "all" && r.severity !== severity) return false;
      if (machineId !== "all" && r.machineId !== machineId) return false;
      if (locationId !== "all" && r.locationId !== locationId) return false;
      if (since && new Date(r.createdAt).getTime() < since) return false;
      if (outOnly && r.machineStatus !== "OUT_OF_SERVICE") return false;
      if (q && !r.machineName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, status, severity, machineId, locationId, period, outOnly, search]);

  const openRows = rows.filter((r) => isOpenDefectStatus(r.status));
  const detail = detailId ? rows.find((r) => r.id === detailId) ?? null : null;

  const cards: { key: string; value: number; tone?: "danger" | "warning" }[] = [
    { key: "open", value: openRows.length },
    { key: "unsafe", value: openRows.filter((r) => r.severity === "UNSAFE").length, tone: "danger" },
    { key: "inRepair", value: rows.filter((r) => r.status === "IN_REPAIR").length, tone: "warning" },
    {
      key: "resolved30",
      value: rows.filter(
        (r) => r.resolvedAt && Date.now() - new Date(r.resolvedAt).getTime() < 30 * 86_400_000 && r.status === "RESOLVED"
      ).length,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Samenvattingskaarten */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.key} className="rounded-2xl border border-border bg-surface-1 px-4 py-3 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              {to(`cards.${c.key}`)}
            </p>
            <p
              className={`mt-1 font-display text-2xl font-bold ${
                c.value > 0 && c.tone === "danger"
                  ? "text-red-600"
                  : c.value > 0 && c.tone === "warning"
                    ? "text-amber-600"
                    : "text-neutral-900"
              }`}
            >
              {c.value}
            </p>
          </div>
        ))}
      </div>

      {/* Filterbalk */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={to("filters.search")}
            className="w-44 rounded-xl border border-border bg-surface-1 py-2 pl-9 pr-3 text-sm focus-ring"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
          className="rounded-xl border border-border bg-surface-1 px-3 py-2 text-sm focus-ring"
        >
          <option value="open">{to("filters.statusOpen")}</option>
          <option value="all">{to("filters.statusAll")}</option>
          {(Object.keys(DEFECT_STATUS_META) as DefectStatus[]).map((s) => (
            <option key={s} value={s}>
              {t(`status.${s}`)}
            </option>
          ))}
        </select>
        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value as DefectSeverity | "all")}
          className="rounded-xl border border-border bg-surface-1 px-3 py-2 text-sm focus-ring"
        >
          <option value="all">{to("filters.severityAll")}</option>
          {(Object.keys(DEFECT_SEVERITY_META) as DefectSeverity[]).map((s) => (
            <option key={s} value={s}>
              {t(`severity.${s}`)}
            </option>
          ))}
        </select>
        <select
          value={machineId}
          onChange={(e) => setMachineId(e.target.value)}
          className="max-w-44 rounded-xl border border-border bg-surface-1 px-3 py-2 text-sm focus-ring"
        >
          <option value="all">{to("filters.machineAll")}</option>
          {machines.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        {locations.length > 1 ? (
          <select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            className="rounded-xl border border-border bg-surface-1 px-3 py-2 text-sm focus-ring"
          >
            <option value="all">{to("filters.locationAll")}</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        ) : null}
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as PeriodFilter)}
          className="rounded-xl border border-border bg-surface-1 px-3 py-2 text-sm focus-ring"
        >
          <option value="all">{to("filters.periodAll")}</option>
          <option value="7">{to("filters.period7")}</option>
          <option value="30">{to("filters.period30")}</option>
          <option value="90">{to("filters.period90")}</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={outOnly}
            onChange={(e) => setOutOnly(e.target.checked)}
            className="size-4 rounded accent-[var(--tenant-accent,#e84b1f)]"
          />
          {to("filters.outOfServiceOnly")}
        </label>
      </div>

      {/* Tabel */}
      <TableWrap>
        <Table>
          <Thead>
            <tr>
              <Th>{to("table.machine")}</Th>
              <Th>{to("table.symptom")}</Th>
              <Th>{to("table.severity")}</Th>
              <Th className="text-center">{to("table.confirmations")}</Th>
              <Th>{to("table.reporter")}</Th>
              <Th>{to("table.age")}</Th>
              <Th>{to("table.assignee")}</Th>
              <Th>{to("table.status")}</Th>
            </tr>
          </Thead>
          <Tbody>
            {filtered.length === 0 ? (
              <Tr>
                <Td colSpan={8} className="py-8 text-center text-neutral-500">
                  {to("table.empty")}
                </Td>
              </Tr>
            ) : (
              filtered.map((r) => {
                const sev = DEFECT_SEVERITY_META[r.severity];
                const st = DEFECT_STATUS_META[r.status];
                return (
                  <Tr
                    key={r.id}
                    className={`cursor-pointer ${r.severity === "UNSAFE" && isOpenDefectStatus(r.status) ? "bg-red-50/70 hover:bg-red-50" : ""}`}
                  >
                    <Td className="font-medium">
                      <button
                        type="button"
                        onClick={() => setDetailId(r.id)}
                        className="flex items-center gap-2 text-left"
                      >
                        {r.severity === "UNSAFE" && isOpenDefectStatus(r.status) ? (
                          <AlertTriangle className="size-4 shrink-0 text-red-600" />
                        ) : null}
                        <span>{r.machineName}</span>
                        {r.photoCount > 0 ? (
                          <Camera className="size-3.5 shrink-0 text-neutral-400" />
                        ) : null}
                      </button>
                      {locations.length > 1 ? (
                        <p className="mt-0.5 text-xs font-normal text-neutral-400">{r.locationName}</p>
                      ) : null}
                    </Td>
                    <Td>{t(`symptoms.${r.symptom}`)}</Td>
                    <Td>
                      <Badge tone={sev.tone}>{t(`severity.${r.severity}`)}</Badge>
                    </Td>
                    <Td className="text-center">{r.confirmations > 0 ? `+${r.confirmations}` : "—"}</Td>
                    <Td className="text-neutral-600">{r.reporter ?? to("table.anonymous")}</Td>
                    <Td className="text-neutral-600">{defectAgeLabel(r.createdAt)}</Td>
                    <Td className="text-neutral-600">{r.assignedToName ?? "—"}</Td>
                    <Td>
                      <Badge tone={st.tone}>{t(`status.${r.status}`)}</Badge>
                    </Td>
                  </Tr>
                );
              })
            )}
          </Tbody>
        </Table>
      </TableWrap>

      {/* Vaakst gemeld (90 dagen) */}
      {mostReported.length > 0 ? (
        <div className="rounded-2xl border border-border bg-surface-1 p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-neutral-900">{to("mostReported.title")}</h2>
          <p className="mt-0.5 text-xs text-neutral-500">{to("mostReported.subtitle")}</p>
          <ul className="mt-3 flex flex-col gap-1.5">
            {mostReported.map((m) => (
              <li key={m.machineId} className="flex items-center justify-between text-sm">
                <span className="text-neutral-800">{m.name}</span>
                <span className="font-medium text-neutral-500">
                  {to("mostReported.count", { count: m.count })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {detail ? (
        <DefectDetailModal
          defect={detail}
          allRows={rows}
          staff={staff}
          isAdmin={isAdmin}
          onClose={() => setDetailId(null)}
        />
      ) : null}
    </div>
  );
}

// --- Detail --------------------------------------------------------------------

function DefectDetailModal({
  defect,
  allRows,
  staff,
  isAdmin,
  onClose,
}: {
  defect: DefectRow;
  allRows: DefectRow[];
  staff: StaffOption[];
  isAdmin: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("defects");
  const to = useTranslations("owner.defects");
  const [resolveState, resolveAction, resolving] = useActionState<DefectActionState, FormData>(
    resolveDefect,
    {}
  );
  const [rejectState, rejectAction, rejecting] = useActionState<DefectActionState, FormData>(
    rejectDefect,
    {}
  );

  const open = isOpenDefectStatus(defect.status);
  const machineHistory = defect.machineId
    ? allRows.filter((r) => r.machineId === defect.machineId && r.id !== defect.id)
    : [];
  const mergeTargets = machineHistory.filter((r) => isOpenDefectStatus(r.status));
  const canRelease = defect.machineStatus === "OUT_OF_SERVICE";

  const timeline: { label: string; at: string }[] = [
    { label: to("detail.reportedAt"), at: defect.createdAt },
    ...(defect.acknowledgedAt ? [{ label: to("detail.acknowledgedAt"), at: defect.acknowledgedAt }] : []),
    ...(defect.resolvedAt
      ? [
          {
            label: defect.status === "REJECTED" ? to("detail.rejectedAt") : to("detail.resolvedAt"),
            at: defect.resolvedAt,
          },
        ]
      : []),
  ];

  return (
    <Modal open onClose={onClose} title={defect.machineName} className="max-w-2xl">
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={DEFECT_SEVERITY_META[defect.severity].tone}>
            {t(`severity.${defect.severity}`)}
          </Badge>
          <Badge tone={DEFECT_STATUS_META[defect.status].tone}>{t(`status.${defect.status}`)}</Badge>
          <Badge tone="neutral">{t(`symptoms.${defect.symptom}`)}</Badge>
          {defect.confirmations > 0 ? (
            <Badge tone="warning">{to("detail.confirmations", { count: defect.confirmations })}</Badge>
          ) : null}
          {defect.machineStatus === "OUT_OF_SERVICE" ? (
            <Badge tone="danger">{to("detail.machineOut")}</Badge>
          ) : null}
        </div>

        <p className="text-sm text-neutral-500">
          {to("detail.reportedBy", { name: defect.reporter ?? to("table.anonymous") })}
          {" · "}
          {defect.locationName}
        </p>

        {defect.description ? (
          <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-neutral-800">
            {defect.description}
          </p>
        ) : null}

        {/* Foto's via de beschermde route — de Blob-URL komt nooit in de client. */}
        {defect.photoCount > 0 ? (
          <div className="flex flex-wrap gap-3">
            {Array.from({ length: defect.photoCount }, (_, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={`/owner/defects/${defect.id}/photo/${i}`}
                alt={to("detail.photoAlt", { index: i + 1 })}
                className="h-36 max-w-52 rounded-xl border border-border object-cover"
              />
            ))}
          </div>
        ) : null}

        {/* Statustijdlijn */}
        <div className="rounded-xl border border-border px-4 py-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            {to("detail.timeline")}
          </h3>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-neutral-700">
            {timeline.map((e) => (
              <li key={e.label} className="flex justify-between gap-3">
                <span>{e.label}</span>
                <span className="text-neutral-500">{fmtDateTime(e.at)}</span>
              </li>
            ))}
          </ul>
          {defect.resolutionNote ? (
            <p className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-sm text-neutral-700">
              {defect.resolutionNote}
            </p>
          ) : null}
        </div>

        {/* Meldhistorie van dit apparaat */}
        {machineHistory.length > 0 ? (
          <div className="rounded-xl border border-border px-4 py-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              {to("detail.history")}
            </h3>
            <ul className="mt-2 flex flex-col gap-1 text-sm">
              {machineHistory.slice(0, 6).map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-3">
                  <span className="text-neutral-700">{t(`symptoms.${h.symptom}`)}</span>
                  <span className="flex items-center gap-2 text-neutral-500">
                    {defectAgeLabel(h.createdAt)}
                    <Badge tone={DEFECT_STATUS_META[h.status].tone}>{t(`status.${h.status}`)}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* Interne notitie (nooit zichtbaar voor leden) */}
        <form action={saveInternalNote} className="flex flex-col gap-2">
          <input type="hidden" name="defectId" value={defect.id} />
          <Field label={to("detail.internalNote")} hint={to("detail.internalNoteHint")}>
            <Textarea
              name="internalNote"
              defaultValue={defect.internalNote ?? ""}
              rows={2}
              maxLength={2000}
            />
          </Field>
          <div>
            <Button type="submit" variant="outline" size="sm">
              {to("detail.saveNote")}
            </Button>
          </div>
        </form>

        {/* Acties */}
        {open ? (
          <div className="flex flex-col gap-4 border-t border-border pt-4">
            <div className="flex flex-wrap items-center gap-2">
              {defect.status === "OPEN" ? (
                <form action={acknowledgeDefect}>
                  <input type="hidden" name="defectId" value={defect.id} />
                  <Button type="submit" variant="outline" size="sm">
                    {to("actions.acknowledge")}
                  </Button>
                </form>
              ) : null}
              {defect.status !== "IN_REPAIR" ? (
                <form action={startRepair}>
                  <input type="hidden" name="defectId" value={defect.id} />
                  <Button type="submit" variant="outline" size="sm">
                    {to("actions.startRepair")}
                  </Button>
                </form>
              ) : null}
              <form action={assignDefect} className="flex items-center gap-2">
                <input type="hidden" name="defectId" value={defect.id} />
                <Select name="assigneeId" defaultValue={defect.assignedToId ?? ""} className="text-sm">
                  <option value="">{to("actions.assignNone")}</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
                <Button type="submit" variant="outline" size="sm">
                  {to("actions.assign")}
                </Button>
              </form>
              {mergeTargets.length > 0 ? (
                <form action={mergeDefect} className="flex items-center gap-2">
                  <input type="hidden" name="defectId" value={defect.id} />
                  <Select name="targetId" defaultValue={mergeTargets[0].id} className="text-sm">
                    {mergeTargets.map((m) => (
                      <option key={m.id} value={m.id}>
                        {t(`symptoms.${m.symptom}`)} · {defectAgeLabel(m.createdAt)}
                      </option>
                    ))}
                  </Select>
                  <Button type="submit" variant="outline" size="sm">
                    {to("actions.merge")}
                  </Button>
                </form>
              ) : null}
            </div>

            {/* Oplossen: verplichte notitie + optioneel vrijgeven */}
            <form action={resolveAction} className="flex flex-col gap-2 rounded-xl border border-border p-4">
              <input type="hidden" name="defectId" value={defect.id} />
              <Field label={to("actions.resolveNote")} required>
                <Textarea name="resolutionNote" required minLength={3} maxLength={2000} rows={2} />
              </Field>
              {canRelease ? (
                <label className="flex items-center gap-2 text-sm text-neutral-700">
                  <input
                    type="checkbox"
                    name="release"
                    value="1"
                    defaultChecked
                    className="size-4 rounded accent-[var(--tenant-accent,#e84b1f)]"
                  />
                  {to("actions.release")}
                </label>
              ) : null}
              {resolveState.error ? (
                <p className="text-sm text-red-600">{resolveState.error}</p>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                <Button type="submit" size="sm" loading={resolving}>
                  {to("actions.resolve")}
                </Button>
                <Button
                  type="submit"
                  variant="ghost"
                  size="sm"
                  loading={rejecting}
                  formAction={rejectAction}
                  formNoValidate
                >
                  {to("actions.reject")}
                </Button>
              </div>
              {rejectState.error ? (
                <p className="text-sm text-red-600">{rejectState.error}</p>
              ) : null}
            </form>
          </div>
        ) : null}

        {isAdmin ? (
          <div className="flex justify-end border-t border-border pt-3">
            <ConfirmButton
              action={deleteDefect}
              fields={{ defectId: defect.id }}
              label={to("actions.delete")}
              message={to("actions.deleteConfirm")}
            />
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
