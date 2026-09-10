"use client";

import { useState, useTransition } from "react";
import { Check, X, Users } from "@/components/ui/icons";
import {
  markAllPresent,
  setAttendance,
  type AttendanceResult,
} from "@/app/owner/rooster/actions";

/**
 * Aanwezigheid afvinken voor één lessessie. Optimistisch en zonder navigatie
 * (patroon `saveSet` in de actieve training): de trainer staat met een
 * telefoon in de zaal terwijl mensen binnenlopen, dus elke tik moet direct
 * zichtbaar zijn. Mislukt de opslag, dan springt de rij terug en verschijnt de
 * reden — nooit een stille wijziging die er alleen lokaal was.
 *
 * UI hardcoded NL (precedent onderhoud/defecten/inzichten in de owner-area).
 */
export type AttendanceRow = {
  enrollmentId: string;
  name: string;
  status: "ENROLLED" | "ATTENDED" | "NO_SHOW";
};

type Marking = AttendanceRow["status"];

export function AttendancePanel({
  sessionId,
  rows,
  open,
  closedReason,
}: {
  sessionId: string;
  rows: AttendanceRow[];
  /** Staat het afvinkvenster open (vanaf kort vóór de start)? */
  open: boolean;
  closedReason: string;
}) {
  const [state, setState] = useState<Record<string, Marking>>(() =>
    Object.fromEntries(rows.map((r) => [r.enrollmentId, r.status]))
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const statusOf = (row: AttendanceRow): Marking => state[row.enrollmentId] ?? row.status;

  const apply = (row: AttendanceRow, next: Marking) => {
    const previous = statusOf(row);
    if (previous === next) return;
    setState((s) => ({ ...s, [row.enrollmentId]: next }));
    setError(null);
    startTransition(async () => {
      const result: AttendanceResult = await setAttendance({
        enrollmentId: row.enrollmentId,
        status: next,
      });
      if (!result.ok) {
        // Terugdraaien: de lijst mag nooit iets tonen wat de server niet heeft.
        setState((s) => ({ ...s, [row.enrollmentId]: previous }));
        setError(result.error);
      }
    });
  };

  const allPresent = () => {
    const previous = { ...state };
    setState((s) => {
      const next = { ...s };
      for (const r of rows) if ((next[r.enrollmentId] ?? r.status) === "ENROLLED") next[r.enrollmentId] = "ATTENDED";
      return next;
    });
    setError(null);
    startTransition(async () => {
      const result = await markAllPresent(sessionId);
      if (!result.ok) {
        setState(previous);
        setError(result.error);
      }
    });
  };

  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-surface-1 px-4 py-6 text-center text-sm text-neutral-500">
        Niemand aangemeld voor deze les.
      </p>
    );
  }

  const counts = rows.reduce(
    (acc, r) => {
      const s = statusOf(r);
      acc[s] += 1;
      return acc;
    },
    { ENROLLED: 0, ATTENDED: 0, NO_SHOW: 0 } as Record<Marking, number>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-neutral-600">
          <span className="font-semibold text-neutral-900">{counts.ATTENDED}</span> aanwezig
          {counts.NO_SHOW > 0 ? <> · {counts.NO_SHOW} no-show</> : null}
          {counts.ENROLLED > 0 ? <> · {counts.ENROLLED} nog niet afgevinkt</> : null}
        </p>
        {open && counts.ENROLLED > 0 ? (
          <button
            type="button"
            onClick={allPresent}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-accent-foreground active:opacity-90 disabled:opacity-50"
          >
            <Users className="size-4" />
            Iedereen aanwezig
          </button>
        ) : null}
      </div>

      {!open ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {closedReason}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <ul className="flex flex-col divide-y divide-neutral-100 overflow-hidden rounded-xl border border-border bg-surface-1">
        {rows.map((row) => {
          const status = statusOf(row);
          return (
            <li key={row.enrollmentId} className="flex items-center justify-between gap-3 px-4 py-3">
              <span
                className={`min-w-0 flex-1 truncate text-sm ${
                  status === "NO_SHOW" ? "text-neutral-400" : "text-neutral-900"
                }`}
              >
                {row.name}
              </span>
              <span className="flex shrink-0 gap-2">
                <button
                  type="button"
                  aria-pressed={status === "ATTENDED"}
                  aria-label={`${row.name} aanwezig`}
                  disabled={!open}
                  onClick={() => apply(row, status === "ATTENDED" ? "ENROLLED" : "ATTENDED")}
                  className={`inline-flex size-10 items-center justify-center rounded-lg border transition-colors disabled:opacity-40 ${
                    status === "ATTENDED"
                      ? "border-green-600 bg-green-600 text-white"
                      : "border-border bg-surface-1 text-neutral-500 active:bg-surface-2"
                  }`}
                >
                  <Check className="size-5" />
                </button>
                <button
                  type="button"
                  aria-pressed={status === "NO_SHOW"}
                  aria-label={`${row.name} niet gekomen`}
                  disabled={!open}
                  onClick={() => apply(row, status === "NO_SHOW" ? "ENROLLED" : "NO_SHOW")}
                  className={`inline-flex size-10 items-center justify-center rounded-lg border transition-colors disabled:opacity-40 ${
                    status === "NO_SHOW"
                      ? "border-red-600 bg-red-600 text-white"
                      : "border-border bg-surface-1 text-neutral-500 active:bg-surface-2"
                  }`}
                >
                  <X className="size-5" />
                </button>
              </span>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-neutral-500">
        Wat op &quot;nog niet afgevinkt&quot; blijft staan wordt 12 uur na afloop automatisch een
        no-show.
      </p>
    </div>
  );
}
