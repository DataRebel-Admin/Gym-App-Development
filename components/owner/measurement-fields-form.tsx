"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  COMPOSITION_METRICS,
  CIRCUMFERENCE_METRICS,
  CONDITION_METRICS,
  isMetricEnabled,
  type MetricDef,
  type MetricKey,
} from "@/lib/measurement-meta";
import { setMeasurementFields } from "@/app/owner/settings/actions";

const GROUPS: { title: string; metrics: MetricDef[] }[] = [
  { title: "Lichaamssamenstelling", metrics: COMPOSITION_METRICS },
  { title: "Omtrekmetingen", metrics: CIRCUMFERENCE_METRICS },
  { title: "Conditie", metrics: CONDITION_METRICS },
];

/**
 * Kies welke meetvelden de sportschool gebruikt. Niet-geselecteerde velden
 * verdwijnen uit formulieren, grafieken, tijdlijn en detail — voor trainer én
 * lid. `enabled = null` = alle velden actief (standaard).
 */
export function MeasurementFieldsForm({ enabled }: { enabled: MetricKey[] | null }) {
  const { success } = useToast();
  const [checked, setChecked] = useState<Set<MetricKey>>(
    () => new Set(GROUPS.flatMap((g) => g.metrics).map((m) => m.key).filter((k) => isMetricEnabled(k, enabled)))
  );

  const allKeys = GROUPS.flatMap((g) => g.metrics).map((m) => m.key);

  function toggle(key: MetricKey, on: boolean) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  return (
    <form
      action={async (fd) => {
        await setMeasurementFields(fd);
        success("Meetvelden opgeslagen");
      }}
      className="flex flex-col gap-5"
    >
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setChecked(new Set(allKeys))}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-surface-2"
        >
          Alles selecteren
        </button>
        <button
          type="button"
          onClick={() => setChecked(new Set())}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-surface-2"
        >
          Niets selecteren
        </button>
      </div>

      <div className="flex flex-col gap-5">
        {GROUPS.map((g) => (
          <fieldset key={g.title} className="flex flex-col gap-2">
            <legend className="text-xs font-medium uppercase tracking-wide text-neutral-400">
              {g.title}
            </legend>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {g.metrics.map((m) => {
                const on = checked.has(m.key);
                return (
                  <label
                    key={m.key}
                    className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-border bg-surface-0 px-3 py-2 text-sm text-neutral-800 transition-colors hover:bg-surface-2"
                  >
                    <input
                      type="checkbox"
                      name="field"
                      value={m.key}
                      checked={on}
                      onChange={(e) => toggle(m.key, e.target.checked)}
                      className="size-4 accent-accent"
                    />
                    <span className="flex-1">{m.label}</span>
                    {m.unit ? <span className="text-xs text-neutral-400">{m.unit}</span> : null}
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>

      <div>
        <Button type="submit" size="md">
          Meetvelden opslaan
        </Button>
      </div>
    </form>
  );
}
