"use client";

import { useActionState, useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button, buttonClasses } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toggleFeature, type ToggleFeatureState } from "@/app/admin/features/actions";
import type { FeatureFlagRow } from "@/lib/features/service";

const dateFmt = new Intl.DateTimeFormat("nl-NL", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function LastChanged({ row }: { row: FeatureFlagRow }) {
  if (!row.overridden || !row.updatedAt) {
    return (
      <span className="text-xs text-neutral-400">
        Nooit gewijzigd · standaardwaarde
      </span>
    );
  }
  return (
    <span className="text-xs text-neutral-500">
      Laatst gewijzigd {dateFmt.format(new Date(row.updatedAt))}
      {row.updatedByEmail ? ` · door ${row.updatedByEmail}` : ""}
    </span>
  );
}

function FeatureCard({ tenantId, row }: { tenantId: string; row: FeatureFlagRow }) {
  const [state, formAction, pending] = useActionState<ToggleFeatureState, FormData>(
    toggleFeature,
    {}
  );
  const [open, setOpen] = useState(false);
  const target = !row.enabled;

  // Sluit de bevestigingsmodal zodra de wijziging is opgeslagen.
  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state.ok]);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-1 p-5 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 gap-3">
        <span className="text-2xl" aria-hidden>
          {row.icon}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-neutral-900">{row.name}</h3>
            <Badge tone={row.enabled ? "success" : "neutral"}>
              {row.enabled ? "Aan" : "Uit"}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-neutral-500">{row.description}</p>
          <div className="mt-2">
            <LastChanged row={row} />
          </div>
          {state.error ? (
            <p className="mt-2 text-xs text-red-600">{state.error}</p>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:pt-1">
        <button
          type="button"
          role="switch"
          aria-checked={row.enabled}
          aria-label={`${row.name} ${row.enabled ? "uitschakelen" : "inschakelen"}`}
          onClick={() => setOpen(true)}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
            row.enabled ? "bg-accent" : "bg-neutral-300"
          }`}
        >
          <span
            className={`inline-block size-5 rounded-full bg-white shadow transition-transform ${
              row.enabled ? "translate-x-[22px]" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={target ? `${row.name} inschakelen?` : `${row.name} uitschakelen?`}
      >
        <p className="text-sm text-neutral-600">
          {target
            ? `De module wordt beschikbaar voor deze sportschool. Menu-items en functionaliteit verschijnen direct.`
            : `De module verdwijnt volledig uit de sportschool: geen menu-items, geen pagina's en geen meldingen. Bestaande gegevens blijven behouden en komen terug zodra je 'm weer inschakelt.`}
        </p>
        <form action={formAction} className="mt-5 flex justify-end gap-2">
          <input type="hidden" name="tenantId" value={tenantId} />
          <input type="hidden" name="key" value={row.key} />
          <input type="hidden" name="enabled" value={String(target)} />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className={buttonClasses({ variant: "outline", size: "sm" })}
          >
            Annuleren
          </button>
          <Button
            type="submit"
            size="sm"
            variant={target ? "primary" : "danger"}
            loading={pending}
          >
            {target ? "Inschakelen" : "Uitschakelen"}
          </Button>
        </form>
      </Modal>
    </div>
  );
}

/** Lijst van feature-kaarten met toggle + bevestiging voor één tenant. */
export function FeatureFlagsManager({
  tenantId,
  rows,
}: {
  tenantId: string;
  rows: FeatureFlagRow[];
}) {
  return (
    <div className="flex flex-col gap-3">
      {rows.map((row) => (
        <FeatureCard key={row.key} tenantId={tenantId} row={row} />
      ))}
    </div>
  );
}
