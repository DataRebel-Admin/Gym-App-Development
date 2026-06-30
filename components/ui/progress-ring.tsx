"use client";

import { m, useReducedMotion } from "motion/react";
import { cn } from "@/lib/cn";

/**
 * Geanimeerde voortgangsring (SVG). Vult van 0 → `value`% zodra gemount.
 * Kleur = tenant-accent. Reduced-motion → direct gevuld.
 */
export function ProgressRing({
  value,
  size = 120,
  strokeWidth = 10,
  label,
  sublabel,
  className,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  label?: React.ReactNode;
  sublabel?: React.ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const pct = Math.max(0, Math.min(100, value));
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--neutral-200)"
          strokeWidth={strokeWidth}
        />
        <m.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--tenant-accent)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: reduced ? offset : c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: reduced ? 0 : 1, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {label ? (
          <span className="font-display text-xl font-bold text-neutral-900">
            {label}
          </span>
        ) : null}
        {sublabel ? (
          <span className="text-xs text-neutral-500">{sublabel}</span>
        ) : null}
      </div>
    </div>
  );
}
