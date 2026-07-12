"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { ChevronRight, Check, Plus } from "@/components/ui/icons";
import { getExerciseType, type ParamField } from "@/lib/exercise-types";
import {
  defaultLogInputValues,
  entryToLogInputValues,
  type InputValues,
} from "@/lib/exercise-params";
import type { ActiveExercise, SessionActions } from "./active-session";

/** Eén log-veld (mobile-first) voor de live training. */
function LogField({
  field,
  value,
  onChange,
}: {
  field: ParamField;
  value: string;
  onChange: (v: string) => void;
}) {
  const label = `${field.label}${field.unit && field.kind !== "enum" ? ` (${field.unit})` : ""}`;

  return (
    <label className="flex flex-1 flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">
        {label}
      </span>
      {field.kind === "enum" ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="rounded-xl border border-border bg-surface-0 px-3 py-2.5 text-sm font-semibold text-neutral-900 outline-none focus:border-accent"
        >
          <option value="">—</option>
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : field.kind === "text" ? (
        <input
          type="text"
          value={value}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="rounded-xl border border-border bg-surface-0 px-3 py-2.5 text-sm text-neutral-900 outline-none focus:border-accent"
        />
      ) : (
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step={field.step ?? (field.kind === "float" ? 0.5 : 1)}
          value={value}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="rounded-xl border border-border bg-surface-0 px-3 py-2.5 text-center font-display text-lg font-bold tabular-nums text-neutral-900 outline-none focus:border-accent [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        />
      )}
    </label>
  );
}

type Row = { values: InputValues; saved: boolean };

/**
 * Type-bewuste oefeningkaart voor alle niet-kracht-types tijdens een training.
 * `single`-types (cardio/duur/mobiliteit/stretch/circuit/HIIT/overig) loggen één
 * resultaat; `sets`-types (isometrisch/core) loggen per set. De velden komen uit
 * de registry (logFields) — de sporter ziet alleen wat relevant is.
 */
export function DynamicExerciseBlock({
  exercise,
  sessionId,
  saveLog,
  onDoneChange,
  onSetDone,
}: {
  exercise: ActiveExercise;
  sessionId: string;
  saveLog: SessionActions["saveLog"];
  onDoneChange: (done: boolean) => void;
  onSetDone: (restSeconds: number) => void;
}) {
  const t = useTranslations("member.active");
  const type = getExerciseType(exercise.exerciseType);
  const TypeIcon = type.icon;
  const [, startTransition] = useTransition();

  const initialRows = useMemo<Row[]>(() => {
    const count = type.logModel === "single" ? 1 : Math.max(exercise.sets, 1);
    return Array.from({ length: count }, (_, i) => {
      const entry = exercise.entries.find((e) => e.setNumber === i + 1);
      return entry
        ? { values: entryToLogInputValues(entry, exercise.exerciseType), saved: true }
        : { values: defaultLogInputValues(exercise.exerciseType), saved: false };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [rows, setRows] = useState<Row[]>(initialRows);

  function reportDone(next: Row[]) {
    onDoneChange(next.length > 0 && next.every((r) => r.saved));
  }

  function setValue(idx: number, fieldId: string, v: string) {
    setRows((prev) => {
      const next = prev.slice();
      next[idx] = { values: { ...next[idx].values, [fieldId]: v }, saved: false };
      reportDone(next);
      return next;
    });
  }

  function saveRow(idx: number) {
    const row = rows[idx];
    setRows((prev) => {
      const next = prev.slice();
      next[idx] = { ...next[idx], saved: true };
      reportDone(next);
      return next;
    });
    startTransition(async () => {
      await saveLog({
        sessionId,
        exerciseId: exercise.exerciseId,
        setNumber: idx + 1,
        values: row.values,
      });
    });
    if (exercise.restSeconds > 0) onSetDone(exercise.restSeconds);
  }

  function addRow() {
    setRows((prev) => {
      const next = [...prev, { values: defaultLogInputValues(exercise.exerciseType), saved: false }];
      reportDone(next);
      return next;
    });
  }

  const isSingle = type.logModel === "single";
  const doneCount = rows.filter((r) => r.saved).length;
  const allDone = doneCount === rows.length;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl border bg-surface-1 p-4 transition-colors",
        allDone ? "border-accent/40" : "border-border"
      )}
    >
      {/* Kop */}
      <Link
        href={`/member/history/exercise/${exercise.exerciseId}`}
        className="flex items-start gap-3 rounded-xl transition-opacity active:opacity-70"
        aria-label={t("viewExplanationOf", { name: exercise.name })}
      >
        {exercise.thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={exercise.thumbUrl} alt="" aria-hidden loading="lazy" decoding="async" className="h-16 w-16 shrink-0 rounded-2xl object-cover shadow-sm" />
        ) : (
          <span className={cn("flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl", type.tone)}>
            <TypeIcon className="size-7" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", type.tone)}>
            <TypeIcon className="size-3" /> {type.label}
          </span>
          <h2 className="mt-1 font-display text-lg font-bold leading-tight text-neutral-900">
            {exercise.name}
          </h2>
          {exercise.targetSummary && exercise.targetSummary !== "—" ? (
            <p className="mt-0.5 text-xs text-neutral-500">{t("targetSummary", { summary: exercise.targetSummary })}</p>
          ) : null}
        </div>
        <span className="mt-0.5 flex shrink-0 items-center gap-0.5 text-xs font-medium text-neutral-400">
          {t("explanation")} <ChevronRight className="size-4" />
        </span>
      </Link>

      {/* Log-velden */}
      <div className="flex flex-col gap-2.5">
        {rows.map((row, idx) => (
          <div
            key={idx}
            className={cn(
              "rounded-2xl border p-3 transition-colors",
              row.saved ? "border-accent/40 bg-accent-soft" : "border-border bg-surface-1"
            )}
          >
            {!isSingle ? (
              <p className="mb-2 text-xs font-semibold text-neutral-500">{t("setLabel", { number: idx + 1 })}</p>
            ) : null}
            <div className="flex flex-wrap items-end gap-2.5">
              {type.logFields.map((field) => (
                <LogField
                  key={field.id}
                  field={field}
                  value={row.values[field.id] ?? ""}
                  onChange={(v) => setValue(idx, field.id, v)}
                />
              ))}
              <button
                type="button"
                onClick={() => saveRow(idx)}
                aria-pressed={row.saved}
                className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-2 text-xl font-bold transition-colors active:scale-90",
                  row.saved
                    ? "border-accent bg-accent text-accent-foreground"
                    : "border-neutral-300 text-neutral-300"
                )}
                aria-label={isSingle ? t("markDone") : t("saveSet", { number: idx + 1 })}
              >
                <Check className="size-5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {!isSingle && rows.length < 20 ? (
        <button
          type="button"
          onClick={addRow}
          className="flex items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border-strong py-2.5 text-sm font-semibold text-neutral-600 active:scale-[0.99]"
        >
          <Plus className="size-4" /> {t("addSet")}
        </button>
      ) : null}
    </div>
  );
}
