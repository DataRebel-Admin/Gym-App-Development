"use client";

import { useActionState, useEffect } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import {
  logMaintenance,
  type MaintenanceActionState,
} from "@/app/owner/maintenance/actions";
import { MAINTENANCE_KINDS, MAINTENANCE_KIND_META, INTERVAL_PRESETS } from "@/lib/maintenance";

const inputClass =
  "rounded-lg border border-border bg-surface-1 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-accent";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Dialoog om onderhoud vast te leggen. Na afronden reset de gebruiksteller en
 * gaat de machine terug naar "Actief" (server-action). Sluit bij succes.
 */
export function LogMaintenanceDialog({
  open,
  onClose,
  machineId,
  machineName,
  currentIntervalDays,
}: {
  open: boolean;
  onClose: () => void;
  machineId: string;
  machineName: string;
  currentIntervalDays: number | null;
}) {
  const [state, formAction, pending] = useActionState<MaintenanceActionState, FormData>(
    logMaintenance,
    {}
  );

  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  return (
    <Modal open={open} onClose={onClose} title={`Onderhoud vastleggen — ${machineName}`}>
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="machineId" value={machineId} />

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm text-neutral-700">
            Soort
            <select name="kind" defaultValue="SERVICE" className={inputClass}>
              {MAINTENANCE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {MAINTENANCE_KIND_META[k].icon} {MAINTENANCE_KIND_META[k].label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-neutral-700">
            Datum
            <input type="date" name="performedAt" defaultValue={todayIso()} className={inputClass} />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          Uitgevoerde actie *
          <input
            name="action"
            required
            className={inputClass}
            placeholder="bv. Kabels gecontroleerd en gesmeerd"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          Opmerking
          <textarea name="note" rows={2} className={inputClass} />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm text-neutral-700">
            Uitvoerder (naam)
            <input
              name="performedByName"
              className={inputClass}
              placeholder="bv. externe monteur"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-neutral-700">
            Kosten (€, optioneel)
            <input name="cost" inputMode="decimal" className={inputClass} placeholder="0,00" />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          Volgende onderhoud over
          <select
            name="nextIntervalDays"
            defaultValue={currentIntervalDays ? String(currentIntervalDays) : "0"}
            className={inputClass}
          >
            <option value="0">Ongewijzigd / geen</option>
            {INTERVAL_PRESETS.map((p) => (
              <option key={p.days} value={p.days}>
                {p.label}
              </option>
            ))}
          </select>
          <span className="text-xs text-neutral-500">
            De volgende onderhoudsdatum wordt vanaf de bovenstaande datum berekend.
          </span>
        </label>

        {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Annuleren
          </Button>
          <Button type="submit" loading={pending}>
            Onderhoud afronden
          </Button>
        </div>
      </form>
    </Modal>
  );
}
