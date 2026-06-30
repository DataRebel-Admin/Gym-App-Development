"use client";

import { useMemo, useState } from "react";
import {
  assignSchemaChunk,
  type AssignOptions,
  type AssignChunkResult,
} from "@/app/owner/schemas/actions";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Search, Check, Users, CalendarClock, FileText, Send } from "@/components/ui/icons";

type Member = { id: string; name: string | null; email: string };
type Mode = "now" | "draft" | "schedule";

const CHUNK = 25;

const MODES: { value: Mode; label: string; hint: string; icon: React.ReactNode }[] = [
  { value: "now", label: "Direct publiceren", hint: "Meteen zichtbaar + melding", icon: <Send className="size-4" /> },
  { value: "schedule", label: "Inplannen", hint: "Beschikbaar vanaf moment", icon: <CalendarClock className="size-4" /> },
  { value: "draft", label: "Concept", hint: "Verborgen, geen melding", icon: <FileText className="size-4" /> },
];

export function SchemaAssignPanel({
  templateId,
  members,
}: {
  templateId: string;
  members: Member[];
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<Mode>("now");
  const [availableFrom, setAvailableFrom] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [message, setMessage] = useState("");

  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<AssignChunkResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        (m.name ?? "").toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
    );
  }, [query, members]);

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((m) => selected.has(m.id));

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

  if (members.length === 0) {
    return <p className="text-sm text-neutral-500">Nog geen leden om aan toe te wijzen.</p>;
  }

  const scheduling = mode === "schedule";
  const busy = progress !== null && progress.done < progress.total;

  async function assign() {
    setError(null);
    setResult(null);
    const ids = [...selected];
    if (ids.length === 0) return;
    if (scheduling && !availableFrom) {
      setError("Kies een publicatiemoment voor het inplannen.");
      return;
    }

    const options: AssignOptions = {
      mode,
      availableFrom: scheduling ? availableFrom : null,
      startDate: startDate || null,
      endDate: endDate || null,
      trainerMessage: message.trim() || null,
    };

    const total = ids.length;
    setProgress({ done: 0, total });
    const acc: AssignChunkResult = { assigned: 0, reassigned: 0, scheduled: 0, drafted: 0 };

    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);
      try {
        const r = await assignSchemaChunk(templateId, chunk, options);
        if (r.error) {
          setError(r.error);
          setProgress(null);
          return;
        }
        acc.assigned += r.assigned;
        acc.reassigned += r.reassigned;
        acc.scheduled += r.scheduled;
        acc.drafted += r.drafted;
      } catch {
        setError("Er ging iets mis tijdens het toewijzen. Probeer opnieuw.");
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

  return (
    <div className="flex flex-col gap-4">
      {/* Zoeken + selecteren */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Zoek leden op naam of e-mail…"
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
              <span className="shrink-0 text-xs text-neutral-400">{m.email}</span>
            </button>
          );
        })}
        {filtered.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-neutral-400">Geen leden gevonden.</p>
        ) : null}
      </div>

      <p className="flex items-center gap-1.5 text-xs text-neutral-500">
        <Users className="size-3.5" /> {selected.size} geselecteerd
      </p>

      {/* Publicatiemodus */}
      <div className="grid grid-cols-3 gap-2">
        {MODES.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setMode(opt.value)}
            className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors ${
              mode === opt.value
                ? "border-accent bg-accent-soft"
                : "border-border hover:bg-neutral-50"
            }`}
          >
            <span className="flex items-center gap-1.5 text-sm font-semibold text-neutral-900">
              {opt.icon} {opt.label}
            </span>
            <span className="text-xs text-neutral-500">{opt.hint}</span>
          </button>
        ))}
      </div>

      {/* Planning + boodschap */}
      <div className="grid gap-3 sm:grid-cols-2">
        {scheduling ? (
          <label className="flex flex-col gap-1 text-sm text-neutral-700 sm:col-span-2">
            Beschikbaar vanaf *
            <input
              type="datetime-local"
              value={availableFrom}
              onChange={(e) => setAvailableFrom(e.target.value)}
              className="rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </label>
        ) : null}
        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          Ingangsdatum
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          Einddatum (optioneel)
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-neutral-700 sm:col-span-2">
          Persoonlijke boodschap (optioneel)
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="Een aanmoediging of toelichting voor je leden…"
            className="rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </label>
      </div>

      {/* Actie + voortgang */}
      <div className="flex flex-col gap-2">
        <Button onClick={assign} disabled={selected.size === 0 || busy} loading={busy}>
          {busy
            ? "Bezig met toewijzen…"
            : mode === "draft"
              ? `Concept klaarzetten voor ${selected.size || ""} ${selected.size === 1 ? "lid" : "leden"}`
              : mode === "schedule"
                ? `Inplannen voor ${selected.size || ""} ${selected.size === 1 ? "lid" : "leden"}`
                : `Toewijzen aan ${selected.size || ""} ${selected.size === 1 ? "lid" : "leden"}`}
        </Button>

        {progress ? (
          <div className="flex flex-col gap-1">
            <ProgressBar value={pct} gradient />
            <span className="text-xs text-neutral-500">
              {progress.done} / {progress.total} verwerkt…
            </span>
          </div>
        ) : null}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        {result ? (
          <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            <Check className="size-4 shrink-0" />
            <span>
              {summarize(result)}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function summarize(r: AssignChunkResult): string {
  const parts: string[] = [];
  if (r.assigned) parts.push(`${r.assigned} toegewezen`);
  if (r.reassigned) parts.push(`${r.reassigned} opnieuw toegewezen`);
  if (r.scheduled) parts.push(`${r.scheduled} ingepland`);
  if (r.drafted) parts.push(`${r.drafted} als concept klaargezet`);
  return parts.length ? `Gelukt — ${parts.join(", ")}.` : "Geen wijzigingen.";
}
