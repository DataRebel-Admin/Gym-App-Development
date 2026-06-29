"use client";

import { useState, useTransition } from "react";
import { saveSet, endSession } from "../actions";

type SetEntry = { setNumber: number; reps: number; weightKg: number };
export type ActiveExercise = {
  exerciseId: string;
  name: string;
  machineName: string | null;
  sets: number;
  targetReps: number;
  entries: SetEntry[];
};

const inputClass =
  "w-16 rounded-md border border-neutral-200 px-2 py-1 text-center text-sm outline-none focus:border-accent";

export function ActiveSession({
  sessionId,
  exercises,
}: {
  sessionId: string;
  exercises: ActiveExercise[];
}) {
  // Lokale (optimistische) waarden per set.
  const [values, setValues] = useState<Record<string, { reps: string; kg: string }>>(
    () => {
      const init: Record<string, { reps: string; kg: string }> = {};
      for (const ex of exercises) {
        for (const e of ex.entries) {
          init[`${ex.exerciseId}:${e.setNumber}`] = {
            reps: String(e.reps),
            kg: String(e.weightKg),
          };
        }
      }
      return init;
    }
  );
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [, startTransition] = useTransition();

  function key(exerciseId: string, setNumber: number) {
    return `${exerciseId}:${setNumber}`;
  }

  function update(k: string, field: "reps" | "kg", value: string) {
    setValues((v) => {
      const prev = v[k] ?? { reps: "", kg: "" };
      return { ...v, [k]: { ...prev, [field]: value } };
    });
    setSaved((s) => ({ ...s, [k]: false }));
  }

  function persist(exerciseId: string, setNumber: number) {
    const k = key(exerciseId, setNumber);
    const cur = values[k];
    if (!cur || (cur.reps === "" && cur.kg === "")) return;
    const reps = Number(cur.reps || 0);
    const weightKg = Number(cur.kg || 0);
    // Optimistisch: meteen als "opgeslagen" tonen; server sync op de achtergrond.
    startTransition(async () => {
      const res = await saveSet({ sessionId, exerciseId, setNumber, reps, weightKg });
      setSaved((s) => ({ ...s, [k]: res.ok }));
    });
  }

  return (
    <div className="flex flex-1 flex-col gap-6 px-5 py-8">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
        Training bezig
      </h1>

      <div className="flex flex-col gap-6">
        {exercises.map((ex) => (
          <section key={ex.exerciseId} className="flex flex-col gap-2">
            <div>
              <h2 className="font-semibold text-neutral-900">{ex.name}</h2>
              <p className="text-xs text-neutral-500">
                doel: {ex.sets} × {ex.targetReps}
                {ex.machineName ? ` · ${ex.machineName}` : ""}
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              {Array.from({ length: ex.sets }, (_, i) => i + 1).map((setNumber) => {
                const k = key(ex.exerciseId, setNumber);
                const cur = values[k] ?? { reps: "", kg: "" };
                return (
                  <div
                    key={setNumber}
                    className="flex items-center gap-3 rounded-lg border border-neutral-200 px-3 py-2"
                  >
                    <span className="w-10 text-sm text-neutral-500">
                      Set {setNumber}
                    </span>
                    <label className="flex items-center gap-1 text-xs text-neutral-500">
                      reps
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        value={cur.reps}
                        placeholder={String(ex.targetReps)}
                        onChange={(e) => update(k, "reps", e.target.value)}
                        onBlur={() => persist(ex.exerciseId, setNumber)}
                        className={inputClass}
                      />
                    </label>
                    <label className="flex items-center gap-1 text-xs text-neutral-500">
                      kg
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        value={cur.kg}
                        placeholder="0"
                        onChange={(e) => update(k, "kg", e.target.value)}
                        onBlur={() => persist(ex.exerciseId, setNumber)}
                        className={inputClass}
                      />
                    </label>
                    <span className="ml-auto text-sm text-green-600">
                      {saved[k] ? "✓" : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <form action={endSession} className="mt-2">
        <input type="hidden" name="sessionId" value={sessionId} />
        <button
          type="submit"
          className="w-full rounded-2xl bg-neutral-900 px-6 py-5 text-center text-lg font-semibold text-white active:opacity-90"
        >
          Klaar
        </button>
      </form>
    </div>
  );
}
