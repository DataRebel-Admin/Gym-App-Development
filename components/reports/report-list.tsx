"use client";

import { useEffect, useState } from "react";
import { useActionState } from "react";
import { m } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { TableWrap, Table, Thead, Th, Tbody, Tr, Td } from "@/components/ui/table";
import { MobileListCard, MobileListRow } from "@/components/ui/mobile-list-card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import type { ReportRowData } from "@/lib/report-query";
import {
  REPORT_TYPE_META,
  REPORT_STATUS_META,
  REPORT_SEVERITY_META,
  REPORT_ORIGIN_META,
  REPORTER_ROLE_LABEL,
} from "@/components/reports/report-meta";
import {
  updateReportStatus,
  updateReportSeverity,
  linkReportDuplicate,
  saveReportNote,
  createReportGithubIssue,
  type ReportActionState,
} from "@/app/admin/meldingen/actions";

const DATE_FMT = new Intl.DateTimeFormat("nl-NL", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** Statustijdlijn-regel, afgeleid uit AuditLog (targetType AppReport). */
export type ReportTimelineEntry = {
  at: string; // ISO
  label: string;
  actor: string | null;
};

export function ReportList({
  rows,
  timeline,
}: {
  rows: ReportRowData[];
  /** Per melding-id de audit-afgeleide statushistorie (nieuwste eerst). */
  timeline: Record<string, ReportTimelineEntry[]>;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Rij uit de (mogelijk ververste) props — zo toont de modal na een actie de
  // actuele status zonder handmatig sync-werk.
  const selected = rows.find((r) => r.id === selectedId) ?? null;

  if (rows.length === 0) {
    return (
      <EmptyState
        icon="🚩"
        title="Geen meldingen"
        description="Er zijn geen meldingen die aan je filters voldoen."
      />
    );
  }

  return (
    <>
      {/* Mobiel: kaarten */}
      <div className="flex flex-col gap-3 md:hidden">
        {rows.map((row) => (
          <button
            key={row.id}
            type="button"
            onClick={() => setSelectedId(row.id)}
            className="text-left"
          >
            <MobileListCard>
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                <Badge tone={REPORT_ORIGIN_META[row.origin].tone}>
                  {REPORT_ORIGIN_META[row.origin].label}
                </Badge>
                <Badge tone={REPORT_TYPE_META[row.type].tone}>
                  {REPORT_TYPE_META[row.type].label}
                </Badge>
                <Badge tone={REPORT_STATUS_META[row.status].tone}>
                  {REPORT_STATUS_META[row.status].label}
                </Badge>
                {row.severity !== "NORMAL" ? (
                  <Badge tone={REPORT_SEVERITY_META[row.severity].tone}>
                    {REPORT_SEVERITY_META[row.severity].label}
                  </Badge>
                ) : null}
              </div>
              <p className="truncate text-sm font-semibold text-neutral-900">{row.title}</p>
              <div className="mt-2 flex flex-col gap-1">
                <MobileListRow label="Gym">{row.tenantName ?? "—"}</MobileListRow>
                <MobileListRow label="Versie">
                  {row.appVersion ?? "—"} · {row.platform ?? "—"}
                </MobileListRow>
                <MobileListRow label="Datum">
                  {DATE_FMT.format(new Date(row.createdAt))}
                </MobileListRow>
              </div>
            </MobileListCard>
          </button>
        ))}
      </div>

      {/* Desktop: tabel */}
      <TableWrap className="hidden md:block">
        <Table>
          <Thead>
            <tr>
              <Th>Herkomst</Th>
              <Th>Type</Th>
              <Th>Titel</Th>
              <Th>Status</Th>
              <Th>Prioriteit</Th>
              <Th>Versie</Th>
              <Th>Platform</Th>
              <Th>Gym</Th>
              <Th>Datum</Th>
            </tr>
          </Thead>
          <Tbody>
            {rows.map((row, i) => (
              <m.tr
                key={row.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15, delay: Math.min(i * 0.01, 0.25) }}
                onClick={() => setSelectedId(row.id)}
                className="cursor-pointer transition-colors hover:bg-neutral-50"
              >
                <Td>
                  <Badge tone={REPORT_ORIGIN_META[row.origin].tone}>
                    {REPORT_ORIGIN_META[row.origin].label}
                  </Badge>
                </Td>
                <Td>
                  <Badge tone={REPORT_TYPE_META[row.type].tone}>
                    {REPORT_TYPE_META[row.type].label}
                  </Badge>
                </Td>
                <Td className="max-w-[18rem]">
                  <span className="block truncate font-medium text-neutral-900">
                    {row.title}
                  </span>
                  <span className="block truncate text-xs text-neutral-500">{row.ref}</span>
                </Td>
                <Td>
                  <Badge tone={REPORT_STATUS_META[row.status].tone}>
                    {REPORT_STATUS_META[row.status].label}
                  </Badge>
                </Td>
                <Td>
                  <Badge tone={REPORT_SEVERITY_META[row.severity].tone}>
                    {REPORT_SEVERITY_META[row.severity].label}
                  </Badge>
                </Td>
                <Td className="text-neutral-600">{row.appVersion ?? "—"}</Td>
                <Td className="text-neutral-600">{row.platform ?? "—"}</Td>
                <Td className="max-w-[10rem] truncate text-neutral-600">
                  {row.tenantName ?? "—"}
                </Td>
                <Td className="whitespace-nowrap text-neutral-600">
                  {DATE_FMT.format(new Date(row.createdAt))}
                </Td>
              </m.tr>
            ))}
          </Tbody>
        </Table>
      </TableWrap>

      {selected ? (
        <Modal
          open
          onClose={() => setSelectedId(null)}
          title={`Melding ${selected.ref}`}
          className="max-w-2xl"
        >
          <ReportDetail report={selected} timeline={timeline[selected.id] ?? []} />
        </Modal>
      ) : null}
    </>
  );
}

/* ────────────────────────────── Detailpaneel ────────────────────────────── */

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-2 text-sm">
      <dt className="font-medium text-neutral-500">{label}</dt>
      <dd className="min-w-0 break-words text-neutral-900">{children}</dd>
    </div>
  );
}

function ReportDetail({
  report,
  timeline,
}: {
  report: ReportRowData;
  timeline: ReportTimelineEntry[];
}) {
  const reporterLabel = report.reporterName
    ? `${report.reporterName}${report.reporterEmail ? ` (${report.reporterEmail})` : ""}`
    : report.reporterRole
      ? "Anoniem"
      : "Anoniem / niet ingelogd";

  return (
    <div className="flex flex-col gap-5">
      {/* Kop: badges */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone={REPORT_ORIGIN_META[report.origin].tone}>
          {REPORT_ORIGIN_META[report.origin].label}
        </Badge>
        <Badge tone={REPORT_TYPE_META[report.type].tone}>
          {REPORT_TYPE_META[report.type].label}
        </Badge>
        <Badge tone={REPORT_STATUS_META[report.status].tone}>
          {REPORT_STATUS_META[report.status].label}
        </Badge>
        <Badge tone={REPORT_SEVERITY_META[report.severity].tone}>
          {REPORT_SEVERITY_META[report.severity].label}
        </Badge>
        {report.externalRef ? (
          <a
            href={report.externalRef}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-medium text-accent underline-offset-2 hover:underline"
          >
            GitHub-issue ↗
          </a>
        ) : null}
      </div>

      {/* Omschrijving */}
      <div>
        <h3 className="text-base font-semibold text-neutral-900">{report.title}</h3>
        <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-700">
          {report.description}
        </p>
      </div>

      {/* Screenshot via de beschermde proxy-route (blob-URL blijft server-side) */}
      {report.hasScreenshot ? (
        <div>
          <p className="mb-1.5 text-sm font-medium text-neutral-700">Screenshot</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/admin/meldingen/${report.id}/screenshot`}
            alt="Meegestuurde screenshot"
            className="max-h-80 rounded-xl border border-border object-contain"
          />
        </div>
      ) : null}

      {/* Melder */}
      <dl className="flex flex-col gap-1.5 rounded-xl border border-border bg-surface-1 p-3">
        <DetailRow label="Melder">{reporterLabel}</DetailRow>
        <DetailRow label="Rol">
          {report.reporterRole
            ? (REPORTER_ROLE_LABEL[report.reporterRole] ?? report.reporterRole)
            : "—"}
        </DetailRow>
        <DetailRow label="Sportschool">{report.tenantName ?? "—"}</DetailRow>
        <DetailRow label="Contact toegestaan">
          {report.contactAllowed ? "Ja" : "Nee"}
        </DetailRow>
        <DetailRow label="Gemeld op">
          {DATE_FMT.format(new Date(report.createdAt))}
        </DetailRow>
        {report.duplicateOfId ? (
          <DetailRow label="Duplicaat van">{report.duplicateOfId}</DetailRow>
        ) : null}
      </dl>

      {/* Technische context (uitklapbaar) */}
      <details className="rounded-xl border border-border bg-surface-1 px-3 py-2">
        <summary className="cursor-pointer text-sm font-medium text-neutral-700">
          Technische context
        </summary>
        <dl className="mt-2 flex flex-col gap-1.5">
          <DetailRow label="Route">{report.route ?? "—"}</DetailRow>
          <DetailRow label="App-versie">{report.appVersion ?? "—"}</DetailRow>
          <DetailRow label="Build">{report.buildId ?? "—"}</DetailRow>
          <DetailRow label="Platform">{report.platform ?? "—"}</DetailRow>
          <DetailRow label="OS">{report.osVersion ?? "—"}</DetailRow>
          <DetailRow label="Scherm">{report.screenSize ?? "—"}</DetailRow>
          <DetailRow label="Taal">{report.locale ?? "—"}</DetailRow>
          <DetailRow label="User-agent">
            <span className="break-all text-xs">{report.userAgent ?? "—"}</span>
          </DetailRow>
        </dl>
        {Array.isArray(report.clientErrors) && report.clientErrors.length > 0 ? (
          <div className="mt-3">
            <p className="mb-1 text-sm font-medium text-neutral-700">Laatste client-errors</p>
            <pre className="max-h-48 overflow-auto rounded-lg bg-neutral-900 p-3 text-xs text-neutral-100">
              {JSON.stringify(report.clientErrors, null, 2)}
            </pre>
          </div>
        ) : null}
      </details>

      {/* Statustijdlijn (afgeleid uit de audit-log) */}
      {timeline.length > 0 ? (
        <div>
          <p className="mb-1.5 text-sm font-medium text-neutral-700">Tijdlijn</p>
          <ol className="flex flex-col gap-1.5 border-l-2 border-border pl-3">
            {timeline.map((entry, i) => (
              <li key={i} className="text-sm text-neutral-700">
                <span className="text-xs text-neutral-500">
                  {DATE_FMT.format(new Date(entry.at))}
                </span>{" "}
                · {entry.label}
                {entry.actor ? (
                  <span className="text-neutral-500"> · {entry.actor}</span>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {/* Acties */}
      <div className="flex flex-col gap-4 border-t border-border pt-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <StatusForm report={report} />
          <SeverityForm report={report} />
        </div>
        <DuplicateForm report={report} />
        <NoteForm report={report} />
        <GithubForm report={report} />
      </div>
    </div>
  );
}

/* ─────────────────────────────── Actie-forms ─────────────────────────────── */

function useActionToast(state: ReportActionState, successMessage: string) {
  const toast = useToast();
  useEffect(() => {
    if (state.ok) toast.success(successMessage);
    if (state.error) toast.error(state.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
}

function StatusForm({ report }: { report: ReportRowData }) {
  const [state, formAction, pending] = useActionState<ReportActionState, FormData>(
    updateReportStatus,
    {}
  );
  useActionToast(state, "Status bijgewerkt");
  return (
    <form action={formAction} className="flex items-end gap-2">
      <input type="hidden" name="id" value={report.id} />
      <Field label="Status" className="flex-1">
        <Select name="status" defaultValue={report.status} key={report.status}>
          {Object.entries(REPORT_STATUS_META).map(([value, meta]) => (
            <option key={value} value={value}>
              {meta.label}
            </option>
          ))}
        </Select>
      </Field>
      <Button type="submit" size="sm" variant="outline" loading={pending}>
        Opslaan
      </Button>
    </form>
  );
}

function SeverityForm({ report }: { report: ReportRowData }) {
  const [state, formAction, pending] = useActionState<ReportActionState, FormData>(
    updateReportSeverity,
    {}
  );
  useActionToast(state, "Prioriteit bijgewerkt");
  return (
    <form action={formAction} className="flex items-end gap-2">
      <input type="hidden" name="id" value={report.id} />
      <Field label="Prioriteit" className="flex-1">
        <Select name="severity" defaultValue={report.severity} key={report.severity}>
          {Object.entries(REPORT_SEVERITY_META).map(([value, meta]) => (
            <option key={value} value={value}>
              {meta.label}
            </option>
          ))}
        </Select>
      </Field>
      <Button type="submit" size="sm" variant="outline" loading={pending}>
        Opslaan
      </Button>
    </form>
  );
}

function DuplicateForm({ report }: { report: ReportRowData }) {
  const [state, formAction, pending] = useActionState<ReportActionState, FormData>(
    linkReportDuplicate,
    {}
  );
  useActionToast(state, "Gekoppeld als duplicaat");
  return (
    <form action={formAction} className="flex items-end gap-2">
      <input type="hidden" name="id" value={report.id} />
      <Field
        label="Duplicaat van (melding-id)"
        className="flex-1"
        hint="Zet de status op Duplicaat en koppelt aan het origineel."
      >
        <Input
          name="duplicateOfId"
          defaultValue={report.duplicateOfId ?? ""}
          placeholder="cm…"
        />
      </Field>
      <Button type="submit" size="sm" variant="outline" loading={pending}>
        Koppelen
      </Button>
    </form>
  );
}

function NoteForm({ report }: { report: ReportRowData }) {
  const [state, formAction, pending] = useActionState<ReportActionState, FormData>(
    saveReportNote,
    {}
  );
  useActionToast(state, "Notitie opgeslagen");
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={report.id} />
      <Field label="Interne notitie" hint="Alleen zichtbaar voor het team.">
        <Textarea name="note" rows={3} defaultValue={report.internalNote ?? ""} />
      </Field>
      <div>
        <Button type="submit" size="sm" variant="outline" loading={pending}>
          Notitie opslaan
        </Button>
      </div>
    </form>
  );
}

function GithubForm({ report }: { report: ReportRowData }) {
  const [state, formAction, pending] = useActionState<ReportActionState, FormData>(
    createReportGithubIssue,
    {}
  );
  useActionToast(state, "GitHub-issue aangemaakt");
  if (report.externalRef) {
    return (
      <p className="text-sm text-neutral-600">
        Gekoppeld issue:{" "}
        <a
          href={report.externalRef}
          target="_blank"
          rel="noreferrer"
          className={cn("font-medium text-accent underline-offset-2 hover:underline")}
        >
          {report.externalRef}
        </a>
      </p>
    );
  }
  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={report.id} />
      <Button type="submit" size="sm" loading={pending}>
        Maak GitHub-issue
      </Button>
    </form>
  );
}
