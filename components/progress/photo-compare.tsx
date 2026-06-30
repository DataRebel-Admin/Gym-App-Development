"use client";

import { useState } from "react";
import { POSE_LABEL } from "@/lib/measurement-meta";

export type ComparePhoto = { pose: string; url: string };
export type CompareMeasurement = { id: string; label: string; photos: ComparePhoto[] };

const POSES = ["FRONT", "SIDE", "BACK"];

function pick(m: CompareMeasurement | undefined, pose: string): string | null {
  return m?.photos.find((p) => p.pose === pose)?.url ?? null;
}

/** Vergelijk de voortgangsfoto's van twee metingen naast elkaar (per pose). */
export function PhotoCompare({ measurements }: { measurements: CompareMeasurement[] }) {
  const withPhotos = measurements.filter((m) => m.photos.length > 0);
  const [aId, setAId] = useState(() => withPhotos[withPhotos.length - 1]?.id ?? "");
  const [bId, setBId] = useState(() => withPhotos[0]?.id ?? "");

  if (withPhotos.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border bg-surface-0 px-4 py-8 text-center text-sm text-neutral-500">
        Nog geen voortgangsfoto&apos;s om te vergelijken.
      </p>
    );
  }

  const a = withPhotos.find((m) => m.id === aId);
  const b = withPhotos.find((m) => m.id === bId);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Selector label="Eerder" value={aId} onChange={setAId} options={withPhotos} />
        <Selector label="Later" value={bId} onChange={setBId} options={withPhotos} />
      </div>
      <div className="flex flex-col gap-4">
        {POSES.map((pose) => {
          const ua = pick(a, pose);
          const ub = pick(b, pose);
          if (!ua && !ub) return null;
          return (
            <div key={pose} className="flex flex-col gap-1.5">
              <p className="text-xs font-semibold text-neutral-500">{POSE_LABEL[pose] ?? pose}</p>
              <div className="grid grid-cols-2 gap-3">
                <CompareImg url={ua} />
                <CompareImg url={ub} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CompareImg({ url }: { url: string | null }) {
  if (!url) {
    return (
      <div className="flex aspect-[3/4] items-center justify-center rounded-xl border border-dashed border-border text-xs text-neutral-400">
        Geen foto
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className="aspect-[3/4] w-full rounded-xl border border-border object-cover" />;
}

function Selector({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: CompareMeasurement[];
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-border bg-surface-0 px-3 py-2 text-sm text-neutral-900"
      >
        {options.map((m) => (
          <option key={m.id} value={m.id}>{m.label}</option>
        ))}
      </select>
    </label>
  );
}
