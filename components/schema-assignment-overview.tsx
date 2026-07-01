"use client";

import { useMemo, useState } from "react";
import type { AssignmentStatus } from "@prisma/client";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { ASSIGNMENT_STATUS_META, type ValidityState } from "@/lib/schema-status";

/** Geserialiseerde rij voor het owner-overzicht (datums al server-side geformatteerd). */
export type OverviewRow = {
  id: string;
  memberName: string;
  status: AssignmentStatus;
  personalized: boolean;
  syncAvailable: boolean;
  active: boolean;
  /** SCHEDULED → ingangsmoment, anders publicatiedatum. */
  availableOrPublished: string;
  period: string;
  changed: string;
  /** Hoe lang het lid dit schema al heeft ("3 weken"); "" indien nog niet gepubliceerd. */
  sinceLabel: string;
  seen: "seen" | "new" | "na";
  /** Verloop-status o.b.v. de geldigheidsduur. */
  validityState: ValidityState;
  /** Badge-label ("Verlopen"/"Nieuw schema nodig"/"Geldig"); "" als geen geldigheid. */
  validityLabel: string;
  validityTone: BadgeTone;
  /** Verloopdatum (geformatteerd); "" indien n.v.t. */
  validityExpires: string;
};

type StatusFilter = "all" | "active" | "SCHEDULED" | "DRAFT";

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "Alle" },
  { key: "active", label: "Actief" },
  { key: "SCHEDULED", label: "Gepland" },
  { key: "DRAFT", label: "Concept" },
];

/**
 * Overzicht per schema (owner): aan welke leden toegewezen, publicatiestatus,
 * publicatiedatum, periode, hoe lang ze het al hebben, laatst gewijzigd en gezien.
 * Filterbaar op status en op alleen-aangepaste schema's.
 */
export function SchemaAssignmentOverview({ rows }: { rows: OverviewRow[] }) {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [onlyPersonalized, setOnlyPersonalized] = useState(false);
  const [onlyAttention, setOnlyAttention] = useState(false);

  const active = rows.filter((r) => r.active).length;
  const scheduled = rows.filter((r) => r.status === "SCHEDULED").length;
  const drafts = rows.filter((r) => r.status === "DRAFT").length;
  const personalized = rows.filter((r) => r.personalized).length;
  const syncable = rows.filter((r) => r.syncAvailable).length;
  const attention = rows.filter(
    (r) => r.validityState === "expiring" || r.validityState === "expired"
  ).length;

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (onlyPersonalized && !r.personalized) return false;
        if (onlyAttention && r.validityState !== "expiring" && r.validityState !== "expired") {
          return false;
        }
        if (status === "active") return r.active;
        if (status === "SCHEDULED") return r.status === "SCHEDULED";
        if (status === "DRAFT") return r.status === "DRAFT";
        return true;
      }),
    [rows, status, onlyPersonalized, onlyAttention]
  );

  if (rows.length === 0) {
    return (
      <p className="text-sm text-neutral-500">
        Dit schema is nog niet toegewezen. Gebruik het paneel hierboven.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2 text-xs">
        <Badge tone="success">{active} actief</Badge>
        {scheduled > 0 ? <Badge tone="warning">{scheduled} gepland</Badge> : null}
        {drafts > 0 ? <Badge tone="neutral">{drafts} concept</Badge> : null}
        {personalized > 0 ? <Badge tone="warning">{personalized} aangepast</Badge> : null}
        {syncable > 0 ? <Badge tone="accent">{syncable} sync beschikbaar</Badge> : null}
        {attention > 0 ? <Badge tone="danger">{attention} verloopt/verlopen</Badge> : null}
        <Badge tone="neutral">{rows.length} totaal</Badge>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((o) => {
          const isActive = o.key === status;
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => setStatus(o.key)}
              className={
                isActive
                  ? "rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground"
                  : "rounded-full border border-border px-3 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
              }
            >
              {o.label}
            </button>
          );
        })}
        <label className="ml-1 flex cursor-pointer items-center gap-1.5 text-xs text-neutral-600">
          <input
            type="checkbox"
            checked={onlyPersonalized}
            onChange={(e) => setOnlyPersonalized(e.target.checked)}
            className="accent-accent"
          />
          Alleen aangepast
        </label>
        {attention > 0 ? (
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-neutral-600">
            <input
              type="checkbox"
              checked={onlyAttention}
              onChange={(e) => setOnlyAttention(e.target.checked)}
              className="accent-accent"
            />
            Verloopt / verlopen
          </label>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-2 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-3 py-2 font-medium">Lid</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Template</th>
              <th className="px-3 py-2 font-medium">Beschikbaar / gepubliceerd</th>
              <th className="px-3 py-2 font-medium">Sinds</th>
              <th className="px-3 py-2 font-medium">Geldigheid</th>
              <th className="px-3 py-2 font-medium">Periode</th>
              <th className="px-3 py-2 font-medium">Gewijzigd</th>
              <th className="px-3 py-2 font-medium">Gezien</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const meta = ASSIGNMENT_STATUS_META[r.status];
              const tone: BadgeTone = meta.tone;
              return (
                <tr key={r.id} className="border-t border-neutral-100">
                  <td className="px-3 py-2 font-medium text-neutral-900">{r.memberName}</td>
                  <td className="px-3 py-2">
                    <Badge tone={tone}>{meta.label}</Badge>
                  </td>
                  <td className="px-3 py-2">
                    {r.personalized ? (
                      <Badge tone="warning">Aangepast</Badge>
                    ) : (
                      <Badge tone="neutral">Standaard</Badge>
                    )}
                    {r.syncAvailable ? (
                      <span className="ml-1">
                        <Badge tone="accent">Sync</Badge>
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-neutral-600">{r.availableOrPublished}</td>
                  <td className="px-3 py-2 text-neutral-600">
                    {r.sinceLabel ? (
                      <span className="font-medium text-neutral-800">{r.sinceLabel}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2 text-neutral-600">
                    {r.validityState === "none" ? (
                      "—"
                    ) : (
                      <span className="flex flex-col gap-0.5">
                        <Badge tone={r.validityTone}>{r.validityLabel}</Badge>
                        {r.validityExpires ? (
                          <span className="text-xs text-neutral-400">
                            {r.validityState === "expired" ? "verlopen" : "tot"} {r.validityExpires}
                          </span>
                        ) : null}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-neutral-600">{r.period}</td>
                  <td className="px-3 py-2 text-neutral-600">{r.changed}</td>
                  <td className="px-3 py-2 text-neutral-600">
                    {r.seen === "na" ? "—" : r.seen === "seen" ? "✓" : <span className="text-accent">Nieuw</span>}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-neutral-500">
                  Geen toewijzingen voor dit filter.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
