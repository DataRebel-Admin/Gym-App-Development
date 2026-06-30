"use client";

import { useState } from "react";
import { ProgressRing } from "@/components/ui/progress-ring";

export type ChecklistItem = {
  id: string;
  exerciseName: string;
  machineName: string | null;
  sets: number;
  reps: number;
  restSeconds: number;
  thumbUrl: string | null;
};

export type ChecklistDay = { name: string; items: ChecklistItem[] };

export function SchemaChecklist({
  items,
  days,
}: {
  items?: ChecklistItem[];
  days?: ChecklistDay[];
}) {
  const [done, setDone] = useState<Record<string, boolean>>({});

  function toggle(id: string) {
    setDone((d) => ({ ...d, [id]: !d[id] }));
  }

  // Normaliseer naar dagen (val terug op één naamloze "dag" voor platte lijsten).
  const groups: ChecklistDay[] =
    days && days.length > 0 ? days : [{ name: "", items: items ?? [] }];
  const allItems = groups.flatMap((g) => g.items);
  const completed = allItems.filter((i) => done[i.id]).length;
  const pct = allItems.length > 0 ? Math.round((completed / allItems.length) * 100) : 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-4 rounded-2xl border border-border bg-surface-1 p-4 shadow-sm">
        <ProgressRing
          value={pct}
          size={88}
          strokeWidth={9}
          label={`${pct}%`}
        />
        <div>
          <p className="font-display text-lg font-bold text-neutral-900">
            {completed === allItems.length && allItems.length > 0
              ? "Helemaal klaar! 💪"
              : "Jouw voortgang"}
          </p>
          <p className="text-sm text-neutral-500">
            {completed}/{allItems.length} oefeningen afgevinkt
          </p>
        </div>
      </div>
      {groups.map((group, gi) => (
        <div key={gi} className="flex flex-col gap-2">
          {group.name ? (
            <h3 className="text-sm font-semibold text-neutral-900">{group.name}</h3>
          ) : null}
          <ul className="flex flex-col gap-2">
        {group.items.map((it) => {
          const isDone = Boolean(done[it.id]);
          return (
            <li key={it.id}>
              <button
                type="button"
                onClick={() => toggle(it.id)}
                className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                  isDone
                    ? "border-border bg-neutral-100"
                    : "border-border bg-surface-1"
                }`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                    isDone
                      ? "border-accent bg-accent text-accent-foreground"
                      : "border-neutral-300"
                  }`}
                  aria-hidden
                >
                  {isDone ? "✓" : ""}
                </span>
                {it.thumbUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={it.thumbUrl}
                    alt=""
                    aria-hidden
                    className={`h-10 w-10 shrink-0 rounded-lg object-cover ${
                      isDone ? "opacity-40" : ""
                    }`}
                  />
                ) : null}
                <span className="flex-1">
                  <span
                    className={`block font-medium ${
                      isDone
                        ? "text-neutral-400 line-through"
                        : "text-neutral-900"
                    }`}
                  >
                    {it.exerciseName}
                  </span>
                  <span className="block text-sm text-neutral-500">
                    {it.sets} × {it.reps}
                    {it.machineName ? ` · ${it.machineName}` : " · lichaamsgewicht"}
                    {it.restSeconds ? ` · ${it.restSeconds}s rust` : ""}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
          </ul>
        </div>
      ))}
    </div>
  );
}
