"use client";

import { useActionState, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { MACHINE_TYPES, MACHINE_TYPE_LABELS } from "@/lib/machine";
import { INTERVAL_PRESETS } from "@/lib/maintenance";
import {
  saveMaintenancePolicy,
  type MaintenanceActionState,
} from "@/app/owner/maintenance/actions";

export type PolicyRow = {
  machineType: string;
  usageThreshold: number | null;
  intervalDays: number | null;
};

const inputClass =
  "rounded-lg border border-border bg-surface-1 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-accent";

/**
 * Standaard onderhoudsregels per machinetype. Nieuwe machines van dit type
 * krijgen de regels automatisch; optioneel worden bestaande meteen bijgewerkt.
 */
export function PolicyEditor({ policies }: { policies: PolicyRow[] }) {
  const [type, setType] = useState<string>(MACHINE_TYPES[0]);
  const [state, formAction, pending] = useActionState<MaintenanceActionState, FormData>(
    saveMaintenancePolicy,
    {}
  );

  const current = useMemo(
    () => policies.find((p) => p.machineType === type),
    [policies, type]
  );

  return (
    <div className="rounded-2xl border border-border bg-surface-1 p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-neutral-900">Standaardregels per type</h3>
      <p className="mt-1 text-xs text-neutral-500">
        Stel per machinetype een standaard gebruikslimiet en onderhoudsinterval in.
      </p>

      {/* key forceert een re-mount zodat de defaultValues meelopen met het type. */}
      <form key={type} action={formAction} className="mt-3 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          Type
          <select
            name="machineType"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className={inputClass}
          >
            {MACHINE_TYPES.map((t) => (
              <option key={t} value={t}>
                {MACHINE_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          Gebruikslimiet
          <input
            name="usageThreshold"
            type="number"
            min={0}
            defaultValue={current?.usageThreshold ?? ""}
            className={inputClass}
            placeholder="bv. 500"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          Interval (dagen)
          <input
            name="intervalDays"
            type="number"
            min={0}
            defaultValue={current?.intervalDays ?? ""}
            className={inputClass}
            placeholder="bv. 90"
            list="interval-presets"
          />
          <datalist id="interval-presets">
            {INTERVAL_PRESETS.map((p) => (
              <option key={p.days} value={p.days}>
                {p.label}
              </option>
            ))}
          </datalist>
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm text-neutral-700">
          <input type="checkbox" name="applyToExisting" value="1" className="size-4" />
          Bestaande machines bijwerken
        </label>
        <Button type="submit" loading={pending} className="mb-0.5">
          Opslaan
        </Button>
      </form>
      {state.error ? <p className="mt-2 text-sm text-red-600">{state.error}</p> : null}
      {state.ok ? <p className="mt-2 text-sm text-green-600">Opgeslagen.</p> : null}
    </div>
  );
}
