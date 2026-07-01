"use client";

import { useMemo, useState } from "react";

type Option = { id: string; name: string; targetMuscle: string | null };

/**
 * Zoekbare multi-select voor oefeningen (kader-editor). Schrijft de geselecteerde
 * id's als JSON naar een verborgen input zodat de server-action ze kan lezen.
 * Leeg = geen beperking (alle oefeningen toegestaan).
 */
export function ExerciseMultiSelect({
  name,
  options,
  initialSelected,
}: {
  name: string;
  options: Option[];
  initialSelected: string[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelected));
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? options.filter(
          (o) =>
            o.name.toLowerCase().includes(q) ||
            (o.targetMuscle ?? "").toLowerCase().includes(q)
        )
      : options;
    return base.slice(0, 100);
  }, [query, options]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name={name} value={JSON.stringify([...selected])} />
      <div className="flex items-center justify-between gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Zoek een oefening…"
          className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <span className="shrink-0 text-xs text-neutral-500">{selected.size} gekozen</span>
      </div>
      <div className="max-h-64 overflow-auto rounded-lg border border-border">
        {filtered.length === 0 ? (
          <p className="px-3 py-4 text-center text-sm text-neutral-400">Geen resultaten.</p>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((o) => (
              <li key={o.id}>
                <label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-neutral-50">
                  <input
                    type="checkbox"
                    checked={selected.has(o.id)}
                    onChange={() => toggle(o.id)}
                    className="accent-[var(--tenant-accent)]"
                  />
                  <span className="truncate font-medium text-neutral-900">{o.name}</span>
                  {o.targetMuscle ? (
                    <span className="ml-auto shrink-0 text-xs text-neutral-400">
                      {o.targetMuscle}
                    </span>
                  ) : null}
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="text-xs text-neutral-400">
        Niets geselecteerd = alle oefeningen toegestaan.
      </p>
    </div>
  );
}
