"use client";

import { useState } from "react";
import { m } from "motion/react";
import { cn } from "@/lib/cn";

export type TabItem = { id: string; label: string };

/**
 * Tab-balk met geanimeerde active-indicator (gedeelde layoutId).
 * Controlled via `value`/`onChange`, of standalone met `defaultValue`.
 */
export function Tabs({
  items,
  value,
  defaultValue,
  onChange,
  className,
}: {
  items: TabItem[];
  value?: string;
  defaultValue?: string;
  onChange?: (id: string) => void;
  className?: string;
}) {
  const [internal, setInternal] = useState(defaultValue ?? items[0]?.id);
  const active = value ?? internal;

  function select(id: string) {
    setInternal(id);
    onChange?.(id);
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-xl border border-border bg-surface-0 p-1",
        className
      )}
    >
      {items.map((it) => {
        const isActive = it.id === active;
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => select(it.id)}
            className={cn(
              "relative rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors",
              isActive ? "text-neutral-900" : "text-neutral-500 hover:text-neutral-700"
            )}
          >
            {isActive ? (
              <m.span
                layoutId="tab-indicator"
                className="absolute inset-0 rounded-lg bg-surface-1 shadow-sm"
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              />
            ) : null}
            <span className="relative z-10">{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}
