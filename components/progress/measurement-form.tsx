"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  COMPOSITION_METRICS,
  CIRCUMFERENCE_METRICS,
  MEASUREMENT_SOURCE_LABEL,
  POSE_LABEL,
  type MetricDef,
} from "@/lib/measurement-meta";
import type { MeasurementRow } from "@/lib/measurements";
import type { MeasurementFormState } from "@/app/owner/members/[userId]/progress/actions";

const SOURCES = ["MANUAL", "INBODY", "TANITA", "EVOLT", "GARMIN", "APPLE_HEALTH", "GOOGLE_FIT"];
const POSES = ["FRONT", "SIDE", "BACK"] as const;

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function NumberField({ def, initial }: { def: MetricDef; initial?: number | null }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-neutral-600">
        {def.label}
        {def.unit ? <span className="text-neutral-400"> ({def.unit})</span> : null}
      </span>
      <input
        type="number"
        name={def.key}
        defaultValue={initial ?? ""}
        min={0}
        step={def.integer ? 1 : 0.1}
        inputMode="decimal"
        placeholder="—"
        className="rounded-xl border border-border bg-surface-0 px-3 py-2.5 text-base tabular-nums text-neutral-900 outline-none focus:border-accent"
      />
    </label>
  );
}

function PhotoInput({ pose }: { pose: (typeof POSES)[number] }) {
  const [preview, setPreview] = useState<string | null>(null);
  return (
    <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-surface-0 p-3 text-center transition-colors hover:border-border-strong">
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="" className="aspect-[3/4] w-full rounded-lg object-cover" />
      ) : (
        <div className="flex aspect-[3/4] w-full items-center justify-center text-2xl text-neutral-300">📷</div>
      )}
      <span className="text-xs font-medium text-neutral-600">{POSE_LABEL[pose]}</span>
      <input
        type="file"
        name={`photo_${pose}`}
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          setPreview(file ? URL.createObjectURL(file) : null);
        }}
      />
    </label>
  );
}

/**
 * Groot meting-formulier met logische secties (basis, lichaamssamenstelling,
 * omtrek, foto's) + inline validatie. Eén component voor nieuw én bewerken.
 */
export function MeasurementForm({
  action,
  initial,
  submitLabel,
}: {
  action: (state: MeasurementFormState, formData: FormData) => Promise<MeasurementFormState>;
  initial?: MeasurementRow | null;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<MeasurementFormState, FormData>(action, {});
  const [keptPhotos, setKeptPhotos] = useState<string[]>(
    () => initial?.photos.map((p) => p.id) ?? []
  );

  const measuredAtDefault = initial ? initial.measuredAt.slice(0, 10) : todayISO();

  return (
    <form action={formAction} className="flex flex-col gap-7">
      <input type="hidden" name="existingPhotos" value={JSON.stringify(keptPhotos)} />

      {/* Basis */}
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-neutral-900">Basisgegevens</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-neutral-600">Meetdatum *</span>
            <input
              type="date"
              name="measuredAt"
              required
              defaultValue={measuredAtDefault}
              className="rounded-xl border border-border bg-surface-0 px-3 py-2.5 text-base text-neutral-900 outline-none focus:border-accent"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-neutral-600">Bron / weegschaal</span>
            <select
              name="source"
              defaultValue={initial?.source ?? "MANUAL"}
              className="rounded-xl border border-border bg-surface-0 px-3 py-2.5 text-base text-neutral-900 outline-none focus:border-accent"
            >
              {SOURCES.map((src) => (
                <option key={src} value={src}>{MEASUREMENT_SOURCE_LABEL[src] ?? src}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-neutral-600">Opmerkingen</span>
          <textarea
            name="notes"
            rows={2}
            defaultValue={initial?.notes ?? ""}
            placeholder="Bijv. context, voeding, blessures…"
            className="rounded-xl border border-border bg-surface-0 px-3 py-2.5 text-sm text-neutral-900 outline-none focus:border-accent"
          />
        </label>
      </section>

      {/* Lichaamssamenstelling */}
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-neutral-900">Lichaamssamenstelling</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {COMPOSITION_METRICS.map((def) => (
            <NumberField key={def.key} def={def} initial={initial?.values[def.key]} />
          ))}
        </div>
      </section>

      {/* Omtrek */}
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-neutral-900">Omtrekmetingen (cm)</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {CIRCUMFERENCE_METRICS.map((def) => (
            <NumberField key={def.key} def={def} initial={initial?.values[def.key]} />
          ))}
        </div>
      </section>

      {/* Foto's */}
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-neutral-900">Voortgangsfoto&apos;s</h3>
        {initial && initial.photos.length > 0 ? (
          <div className="flex flex-wrap gap-3">
            {initial.photos.map((p) => {
              const kept = keptPhotos.includes(p.id);
              return (
                <label key={p.id} className="relative cursor-pointer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.url}
                    alt={POSE_LABEL[p.pose] ?? p.pose}
                    className={`h-28 w-20 rounded-lg border-2 object-cover ${kept ? "border-accent" : "border-border opacity-40"}`}
                  />
                  <input
                    type="checkbox"
                    checked={kept}
                    onChange={(e) =>
                      setKeptPhotos((prev) =>
                        e.target.checked ? [...prev, p.id] : prev.filter((id) => id !== p.id)
                      )
                    }
                    className="absolute right-1 top-1"
                  />
                </label>
              );
            })}
            <p className="w-full text-xs text-neutral-400">Vink uit om een foto te verwijderen.</p>
          </div>
        ) : null}
        <div className="grid grid-cols-3 gap-3">
          {POSES.map((pose) => (
            <PhotoInput key={pose} pose={pose} />
          ))}
        </div>
      </section>

      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}

      <div className="flex items-center gap-3">
        <Button type="submit" size="lg" loading={pending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
