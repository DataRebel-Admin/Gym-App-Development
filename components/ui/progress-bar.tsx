"use client";

import { m, useReducedMotion } from "motion/react";
import { cn } from "@/lib/cn";

/**
 * Lineaire voortgangsbalk (accent-gevuld). Animeert van 0 → `value`% bij mount.
 * Reduced-motion → direct gevuld.
 */
export function ProgressBar({
  value,
  className,
  trackClassName,
  gradient = false,
}: {
  value: number;
  className?: string;
  trackClassName?: string;
  /** Gebruik het accent-gradient i.p.v. een vlakke accentkleur. */
  gradient?: boolean;
}) {
  const reduced = useReducedMotion();
  const pct = Math.max(0, Math.min(100, value));

  return (
    <div
      className={cn(
        "h-2.5 w-full overflow-hidden rounded-full bg-surface-2",
        trackClassName
      )}
    >
      <m.div
        className={cn(
          "h-full rounded-full",
          gradient ? "bg-accent-gradient" : "bg-accent",
          className
        )}
        initial={{ width: reduced ? `${pct}%` : 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: reduced ? 0 : 0.5, ease: [0.16, 1, 0.3, 1] }}
      />
    </div>
  );
}
