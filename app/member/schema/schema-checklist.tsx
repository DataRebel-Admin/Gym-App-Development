"use client";

import { useState } from "react";

export type ChecklistItem = {
  id: string;
  exerciseName: string;
  machineName: string | null;
  sets: number;
  reps: number;
  restSeconds: number;
  thumbUrl: string | null;
};

export function SchemaChecklist({ items }: { items: ChecklistItem[] }) {
  const [done, setDone] = useState<Record<string, boolean>>({});

  function toggle(id: string) {
    setDone((d) => ({ ...d, [id]: !d[id] }));
  }

  const completed = items.filter((i) => done[i.id]).length;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-neutral-500">
        {completed}/{items.length} afgevinkt
      </p>
      <ul className="flex flex-col gap-2">
        {items.map((it) => {
          const isDone = Boolean(done[it.id]);
          return (
            <li key={it.id}>
              <button
                type="button"
                onClick={() => toggle(it.id)}
                className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                  isDone
                    ? "border-neutral-200 bg-neutral-50"
                    : "border-neutral-200 bg-white"
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
  );
}
