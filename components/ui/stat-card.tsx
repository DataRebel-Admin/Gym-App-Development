"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useInView, useReducedMotion } from "motion/react";
import { cn } from "@/lib/cn";

/**
 * KPI-kaart met geanimeerd oplopend getal. Telt op zodra de kaart in beeld
 * komt; respecteert prefers-reduced-motion (toont dan direct de eindwaarde).
 */
export function StatCard({
  label,
  value,
  suffix,
  icon,
  hint,
  trend,
  className,
}: {
  label: string;
  value: number;
  suffix?: string;
  icon?: React.ReactNode;
  hint?: string;
  /** ±% t.o.v. vorige periode; toont een gekleurde trend-pill. */
  trend?: number | null;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(reduced ? value : 0);

  useEffect(() => {
    if (!inView) return;
    if (reduced) {
      setDisplay(value);
      return;
    }
    const controls = animate(0, value, {
      duration: 0.9,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [inView, value, reduced]);

  return (
    <div
      ref={ref}
      className={cn(
        "flex flex-col gap-2 rounded-2xl border border-border bg-surface-1 p-5 shadow-sm",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
          {label}
        </span>
        {icon ? (
          <span className="flex size-8 items-center justify-center rounded-lg bg-accent-soft text-accent">
            {icon}
          </span>
        ) : null}
      </div>
      <span className="font-display text-3xl font-bold tabular-nums text-neutral-900">
        {display.toLocaleString("nl-NL")}
        {suffix ? <span className="text-xl text-neutral-400">{suffix}</span> : null}
      </span>
      <div className="flex items-center gap-2">
        {trend != null ? (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold",
              trend > 0
                ? "bg-green-500/15 text-green-600"
                : trend < 0
                  ? "bg-red-500/15 text-red-600"
                  : "bg-neutral-100 text-neutral-500"
            )}
          >
            {trend > 0 ? "▲" : trend < 0 ? "▼" : "—"}
            {Math.abs(trend)}%
          </span>
        ) : null}
        {hint ? <span className="text-xs text-neutral-500">{hint}</span> : null}
      </div>
    </div>
  );
}
