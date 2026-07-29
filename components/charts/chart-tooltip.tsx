"use client";

/**
 * Compacte, strakke tooltip-kaart die past bij het design-system.
 * `unit` default "sessies" (backwards compatible met de dashboard-charts);
 * bij meerdere series (payload > 1) toont hij per serie een rij met kleurstip.
 */
export function ChartTooltip(props: {
  active?: boolean;
  label?: string | number;
  payload?: { value?: number | string; name?: string | number; color?: string }[];
  unit?: string;
}) {
  const { active, payload, label, unit = "sessies" } = props;
  if (!active || !payload?.length) return null;

  const suffix = unit === "%" ? "%" : unit ? ` ${unit}` : "";

  if (payload.length > 1) {
    return (
      <div className="min-w-36 rounded-xl border border-border bg-surface-2 px-3 py-2 text-xs shadow-lg">
        <p className="font-medium text-neutral-500">{label}</p>
        <div className="mt-1 flex flex-col gap-0.5">
          {payload.map((p, i) => (
            <p key={i} className="flex items-baseline gap-1.5">
              <span
                className="inline-block size-2 shrink-0 self-center rounded-full"
                style={{ backgroundColor: p.color }}
                aria-hidden
              />
              <span className="text-neutral-500">{p.name}</span>
              <span className="ml-auto pl-3 font-semibold tabular-nums text-neutral-900">
                {p.value ?? "—"}
                {p.value != null ? suffix : ""}
              </span>
            </p>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface-2 px-3 py-2 text-xs shadow-lg">
      <p className="font-medium text-neutral-500">{label}</p>
      <p className="mt-0.5 font-display text-base font-bold text-neutral-900">
        {payload[0]?.value}
        <span className="ml-1 text-xs font-normal text-neutral-500">{unit}</span>
      </p>
    </div>
  );
}
