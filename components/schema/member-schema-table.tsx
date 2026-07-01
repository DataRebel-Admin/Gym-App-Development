"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import type { ValidityState } from "@/lib/schema-status";

/** Status-bucket voor het filteren (afgeleid van de actieve/aankomende toewijzing). */
export type MemberStatusKey = "active" | "scheduled" | "draft" | "none";

/** Geserialiseerde rij (alle datums al server-side geformatteerd → strings). */
export type MemberSchemaRow = {
  id: string;
  name: string;
  email: string;
  schemaName: string | null;
  statusKey: MemberStatusKey;
  statusLabel: string;
  statusTone: BadgeTone;
  personalized: boolean;
  /** Korte duur ("3 weken") sinds het schema actief/gepland werd; "" indien n.v.t. */
  sinceLabel: string;
  /** Datumlabel ("sinds 5 jun 2026"); "" indien n.v.t. */
  sinceDate: string;
  /** Verloop-status o.b.v. de geldigheidsduur. */
  validityState: ValidityState;
  /** Badge-label ("Verlopen"/"Nieuw schema nodig"); "" indien geen geldigheid. */
  validityLabel: string;
  validityTone: BadgeTone;
};

type StatusFilter = "all" | MemberStatusKey;
type TypeFilter = "all" | "standard" | "personalized";
type ValidityFilter = "all" | "expiring" | "expired";

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "Alle" },
  { key: "active", label: "Actief" },
  { key: "scheduled", label: "Gepland" },
  { key: "draft", label: "Concept" },
  { key: "none", label: "Geen schema" },
];

const TYPE_FILTERS: { key: TypeFilter; label: string }[] = [
  { key: "all", label: "Alle" },
  { key: "standard", label: "Standaard" },
  { key: "personalized", label: "Aangepast" },
];

const VALIDITY_FILTERS: { key: ValidityFilter; label: string }[] = [
  { key: "all", label: "Alle" },
  { key: "expiring", label: "Verloopt bijna" },
  { key: "expired", label: "Verlopen" },
];

function FilterChips<T extends string>({
  options,
  value,
  onChange,
  counts,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  counts?: Record<string, number>;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const active = o.key === value;
        const count = counts?.[o.key];
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            className={
              active
                ? "rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground"
                : "rounded-full border border-border px-3 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
            }
          >
            {o.label}
            {typeof count === "number" ? (
              <span className={active ? "ml-1 opacity-80" : "ml-1 text-neutral-400"}>{count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function MemberSchemaTable({ rows }: { rows: MemberSchemaRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [type, setType] = useState<TypeFilter>("all");
  const [validity, setValidity] = useState<ValidityFilter>("all");

  const statusCounts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length };
    for (const r of rows) c[r.statusKey] = (c[r.statusKey] ?? 0) + 1;
    return c;
  }, [rows]);

  const hasValidity = useMemo(() => rows.some((r) => r.validityState !== "none"), [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== "all" && r.statusKey !== status) return false;
      if (type === "standard" && (r.personalized || r.statusKey === "none")) return false;
      if (type === "personalized" && !r.personalized) return false;
      if (validity !== "all" && r.validityState !== validity) return false;
      if (q && !r.name.toLowerCase().includes(q) && !r.email.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [rows, query, status, type, validity]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-2 p-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Zoek op naam of e-mail…"
          className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-6">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">Status</span>
            <FilterChips options={STATUS_FILTERS} value={status} onChange={setStatus} counts={statusCounts} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">Type</span>
            <FilterChips options={TYPE_FILTERS} value={type} onChange={setType} />
          </div>
          {hasValidity ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                Geldigheid
              </span>
              <FilterChips options={VALIDITY_FILTERS} value={validity} onChange={setValidity} />
            </div>
          ) : null}
        </div>
      </div>

      <p className="text-sm text-neutral-500">
        {filtered.length} van {rows.length} leden
      </p>

      <div className="overflow-hidden rounded-xl border border-neutral-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 text-neutral-500">
            <tr>
              <th className="px-4 py-2 font-medium">Lid</th>
              <th className="px-4 py-2 font-medium">Huidig schema</th>
              <th className="px-4 py-2 font-medium">Sinds</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => {
              const href = `/owner/schemas/members/${m.id}`;
              return (
              <tr
                key={m.id}
                role="link"
                tabIndex={0}
                onClick={() => router.push(href)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    router.push(href);
                  }
                }}
                className="cursor-pointer border-t border-neutral-100 hover:bg-neutral-50 focus:bg-neutral-50 focus:outline-none"
              >
                <td className="px-4 py-2">
                  <div className="font-medium text-neutral-900">{m.name}</div>
                  <div className="text-xs text-neutral-400">{m.email}</div>
                </td>
                <td className="px-4 py-2 text-neutral-700">
                  {m.schemaName ? (
                    <span className="flex flex-wrap items-center gap-2">
                      <span>{m.schemaName}</span>
                      {m.personalized ? (
                        <Badge tone="warning">Aangepast</Badge>
                      ) : (
                        <Badge tone="neutral">Standaard</Badge>
                      )}
                      {m.statusKey !== "active" ? (
                        <Badge tone={m.statusTone}>{m.statusLabel}</Badge>
                      ) : null}
                      {m.validityLabel && m.validityState !== "ok" ? (
                        <Badge tone={m.validityTone}>{m.validityLabel}</Badge>
                      ) : null}
                    </span>
                  ) : (
                    <span className="text-neutral-400">— geen —</span>
                  )}
                </td>
                <td className="px-4 py-2 text-neutral-600">
                  {m.sinceLabel ? (
                    <span className="flex flex-col">
                      <span className="font-medium text-neutral-800">{m.sinceLabel}</span>
                      {m.sinceDate ? (
                        <span className="text-xs text-neutral-400">{m.sinceDate}</span>
                      ) : null}
                    </span>
                  ) : (
                    <span className="text-neutral-400">—</span>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  <span className="text-accent hover:underline">Beheren</span>
                </td>
              </tr>
              );
            })}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-neutral-500">
                  {rows.length === 0 ? "Nog geen leden." : "Geen leden voor deze filters."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
