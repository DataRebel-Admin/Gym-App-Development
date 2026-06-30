"use client";

import { useMemo, useState } from "react";
import { bulkEditChunk, type BulkOp, type BulkResult } from "@/app/owner/schemas/actions";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Search, Check, Users } from "@/components/ui/icons";

type Member = { id: string; name: string | null; email: string; schemaName: string | null };
type Exercise = { id: string; name: string };
type OpType = BulkOp["type"];

const CHUNK = 25;

const OP_TABS: { value: OpType; label: string }[] = [
  { value: "weightDelta", label: "Gewicht ±" },
  { value: "setRest", label: "Rust instellen" },
  { value: "addExercise", label: "Oefening toevoegen" },
  { value: "removeExercise", label: "Oefening verwijderen" },
];

const inputClass =
  "rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-accent";

/**
 * Bulkwijzigingen op de actieve schema's van meerdere leden: gewicht ±, rust
 * instellen, oefening toevoegen/verwijderen. Multi-select + chunked uitvoeren met
 * echte voortgangsbalk (zoals de toewijs-flow). Werkt op de persoonlijke kopieën.
 */
export function SchemaBulkPanel({
  members,
  exercises,
}: {
  members: Member[];
  exercises: Exercise[];
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [opType, setOpType] = useState<OpType>("weightDelta");
  const [delta, setDelta] = useState("2.5");
  const [restSeconds, setRestSeconds] = useState("90");
  const [scopeExerciseId, setScopeExerciseId] = useState("");
  const [targetExerciseId, setTargetExerciseId] = useState("");
  const [sets, setSets] = useState("3");
  const [reps, setReps] = useState("10");

  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<BulkResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) => (m.name ?? "").toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
    );
  }, [query, members]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((m) => selected.has(m.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setResult(null);
  }
  function toggleAllFiltered() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) filtered.forEach((m) => next.delete(m.id));
      else filtered.forEach((m) => next.add(m.id));
      return next;
    });
    setResult(null);
  }

  function buildOp(): BulkOp | { error: string } {
    if (opType === "weightDelta") {
      const d = Number(delta);
      if (!Number.isFinite(d) || d === 0) return { error: "Vul een gewichtsverschil in (bv. 2.5 of -5)." };
      return { type: "weightDelta", delta: d, exerciseId: scopeExerciseId || null };
    }
    if (opType === "setRest") {
      const r = Number(restSeconds);
      if (!Number.isFinite(r) || r < 0) return { error: "Vul een geldige rusttijd in." };
      return { type: "setRest", restSeconds: Math.round(r), exerciseId: scopeExerciseId || null };
    }
    if (opType === "addExercise") {
      if (!targetExerciseId) return { error: "Kies een oefening om toe te voegen." };
      return {
        type: "addExercise",
        exerciseId: targetExerciseId,
        sets: Number(sets) || 3,
        reps: Number(reps) || 10,
        restSeconds: Number(restSeconds) || 60,
      };
    }
    if (!targetExerciseId) return { error: "Kies een oefening om te verwijderen." };
    return { type: "removeExercise", exerciseId: targetExerciseId };
  }

  const busy = progress !== null && progress.done < progress.total;

  async function run() {
    setError(null);
    setResult(null);
    const ids = [...selected];
    if (ids.length === 0) return;
    const op = buildOp();
    if ("error" in op) {
      setError(op.error);
      return;
    }

    const total = ids.length;
    setProgress({ done: 0, total });
    const acc: BulkResult = { updated: 0, skipped: 0 };
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);
      try {
        const r = await bulkEditChunk(chunk, op);
        if (r.error) {
          setError(r.error);
          setProgress(null);
          return;
        }
        acc.updated += r.updated;
        acc.skipped += r.skipped;
      } catch {
        setError("Er ging iets mis. Probeer opnieuw.");
        setProgress(null);
        return;
      }
      setProgress({ done: Math.min(i + CHUNK, total), total });
    }
    setResult(acc);
    setProgress(null);
    setSelected(new Set());
  }

  const pct = progress ? Math.round((progress.done / progress.total) * 100) : 0;
  const showScope = opType === "weightDelta" || opType === "setRest";
  const showTarget = opType === "addExercise" || opType === "removeExercise";

  if (members.length === 0) {
    return <p className="text-sm text-neutral-500">Nog geen leden met een actief schema.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Leden zoeken + multi-select */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Zoek leden…"
            className="w-full rounded-lg border border-border py-2 pl-9 pr-3 text-sm outline-none focus:border-accent"
          />
        </div>
        <button
          type="button"
          onClick={toggleAllFiltered}
          className="shrink-0 rounded-lg border border-border px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          {allFilteredSelected ? "Deselecteer" : "Selecteer alle"}
        </button>
      </div>

      <div className="max-h-64 overflow-auto rounded-lg border border-border">
        {filtered.map((m) => {
          const checked = selected.has(m.id);
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => toggle(m.id)}
              className="flex w-full items-center gap-3 border-b border-neutral-100 px-3 py-2 text-left text-sm last:border-0 hover:bg-neutral-50"
            >
              <span
                className={`flex size-5 shrink-0 items-center justify-center rounded-md border ${
                  checked ? "border-accent bg-accent text-accent-foreground" : "border-border"
                }`}
              >
                {checked ? <Check className="size-3.5" /> : null}
              </span>
              <span className="min-w-0 flex-1 truncate font-medium text-neutral-900">
                {m.name ?? m.email}
              </span>
              <span className="shrink-0 text-xs text-neutral-400">
                {m.schemaName ?? "geen schema"}
              </span>
            </button>
          );
        })}
      </div>
      <p className="flex items-center gap-1.5 text-xs text-neutral-500">
        <Users className="size-3.5" /> {selected.size} geselecteerd
      </p>

      {/* Bewerking kiezen */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {OP_TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => {
              setOpType(t.value);
              setResult(null);
            }}
            className={`rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
              opType === t.value ? "border-accent bg-accent-soft text-neutral-900" : "border-border text-neutral-600 hover:bg-neutral-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Parameters per bewerking */}
      <div className="grid gap-3 sm:grid-cols-2">
        {opType === "weightDelta" ? (
          <label className="flex flex-col gap-1 text-sm text-neutral-700">
            Gewicht aanpassen (kg, ± toegestaan)
            <input type="number" step={0.5} value={delta} onChange={(e) => setDelta(e.target.value)} className={inputClass} />
          </label>
        ) : null}
        {opType === "setRest" ? (
          <label className="flex flex-col gap-1 text-sm text-neutral-700">
            Rusttijd (seconden)
            <input type="number" min={0} value={restSeconds} onChange={(e) => setRestSeconds(e.target.value)} className={inputClass} />
          </label>
        ) : null}
        {showScope ? (
          <label className="flex flex-col gap-1 text-sm text-neutral-700">
            Alleen voor oefening (optioneel)
            <select value={scopeExerciseId} onChange={(e) => setScopeExerciseId(e.target.value)} className={inputClass}>
              <option value="">Alle oefeningen</option>
              {exercises.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </label>
        ) : null}
        {showTarget ? (
          <label className="flex flex-col gap-1 text-sm text-neutral-700">
            Oefening
            <select value={targetExerciseId} onChange={(e) => setTargetExerciseId(e.target.value)} className={inputClass}>
              <option value="">Kies een oefening…</option>
              {exercises.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </label>
        ) : null}
        {opType === "addExercise" ? (
          <div className="grid grid-cols-3 gap-2 sm:col-span-2">
            <label className="flex flex-col gap-1 text-sm text-neutral-700">sets
              <input type="number" min={1} value={sets} onChange={(e) => setSets(e.target.value)} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1 text-sm text-neutral-700">reps
              <input type="number" min={1} value={reps} onChange={(e) => setReps(e.target.value)} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1 text-sm text-neutral-700">rust (s)
              <input type="number" min={0} value={restSeconds} onChange={(e) => setRestSeconds(e.target.value)} className={inputClass} />
            </label>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Button onClick={run} disabled={selected.size === 0 || busy} loading={busy}>
          {busy ? "Bezig…" : `Toepassen op ${selected.size || ""} ${selected.size === 1 ? "lid" : "leden"}`}
        </Button>
        {progress ? (
          <div className="flex flex-col gap-1">
            <ProgressBar value={pct} gradient />
            <span className="text-xs text-neutral-500">{progress.done} / {progress.total} verwerkt…</span>
          </div>
        ) : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {result ? (
          <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            <Check className="size-4 shrink-0" />
            <span>
              Gelukt — {result.updated} bijgewerkt
              {result.skipped > 0 ? `, ${result.skipped} overgeslagen (geen match)` : ""}.
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
