"use client";

/** Compacte, strakke tooltip-kaart die past bij het design-system. */
export function ChartTooltip(props: {
  active?: boolean;
  label?: string | number;
  payload?: { value?: number | string }[];
}) {
  const { active, payload, label } = props;
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-surface-2 px-3 py-2 text-xs shadow-lg">
      <p className="font-medium text-neutral-500">{label}</p>
      <p className="mt-0.5 font-display text-base font-bold text-neutral-900">
        {payload[0]?.value}
        <span className="ml-1 text-xs font-normal text-neutral-500">sessies</span>
      </p>
    </div>
  );
}
