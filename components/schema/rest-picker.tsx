"use client";

import { useState } from "react";
import { REST_PRESETS_SECONDS } from "@/lib/exercise-groups";
import type { ParamField } from "@/lib/exercise-types";
import { selectOnFocus } from "@/lib/select-on-focus";

/**
 * Rust kiezen gebeurt met chips (presets + "Aangepast"), niet met een los
 * getalveld — dat stond er dubbel in beide schema-editors.
 * Gedeeld door de owner-editor en de mobiele lid-builder.
 */

/** De rust hoort bij de <RestPicker>, dus niet bij de dynamische doelvelden. */
export function isRestField(field: ParamField): boolean {
  return field.column === "restSeconds";
}

/** Compacte "Nm"/"Ns"-weergave voor een rust-preset. */
export function restPresetLabel(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s === 0 ? `${m}m` : `${m}m${s}`;
}

const PRESETS: readonly number[] = REST_PRESETS_SECONDS;

function isPresetValue(value: string): boolean {
  return PRESETS.some((sec) => String(sec) === value);
}

const chipClass = (active: boolean) =>
  `rounded-full border px-2 py-0.5 font-medium transition-colors ${
    active
      ? "border-transparent bg-accent-soft text-accent"
      : "border-border text-neutral-500 hover:bg-surface-2 active:bg-surface-2"
  }`;

export function RestPicker({
  value,
  min,
  max,
  onChange,
  children,
}: {
  /** Huidige waarde in seconden (invoer-string, "" = niet ingesteld). */
  value: string;
  min?: number;
  max?: number;
  onChange: (v: string) => void;
  /** Extra bediening achter de chips (bv. "→ alle in dag"). */
  children?: React.ReactNode;
}) {
  const trimmed = value.trim();
  const hasCustomValue = trimmed !== "" && !isPresetValue(trimmed);
  const [customOpen, setCustomOpen] = useState(false);
  const customActive = hasCustomValue || customOpen;

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-neutral-500">
      <span className="text-neutral-400">Rust:</span>
      {PRESETS.map((sec) => {
        const active = !customActive && trimmed === String(sec);
        return (
          <button
            key={sec}
            type="button"
            onClick={() => {
              setCustomOpen(false);
              onChange(String(sec));
            }}
            aria-pressed={active}
            className={chipClass(active)}
          >
            {restPresetLabel(sec)}
          </button>
        );
      })}
      <button
        type="button"
        onClick={() => setCustomOpen(true)}
        aria-pressed={customActive}
        className={chipClass(customActive)}
      >
        Aangepast
      </button>
      {customActive ? (
        <label className="flex items-center gap-1">
          <input
            type="number"
            inputMode="numeric"
            min={min ?? 0}
            max={max}
            step={1}
            value={trimmed}
            autoFocus={customOpen && !hasCustomValue}
            onChange={(e) => onChange(e.target.value)}
            {...selectOnFocus}
            onBlur={(e) => {
              selectOnFocus.onBlur(e);
              // Clamp op de (kader-)grenzen — de client bepaalt niets, maar
              // de coach/het lid ziet direct wat er opgeslagen wordt.
              const raw = e.target.value.trim();
              if (raw === "") return;
              let n = Number(raw.replace(",", "."));
              if (!Number.isFinite(n)) return;
              n = Math.round(n);
              if (min != null && n < min) n = min;
              if (max != null && n > max) n = max;
              if (String(n) !== raw) onChange(String(n));
            }}
            aria-label="Rust in seconden"
            className="w-16 rounded-md border border-border px-2 py-0.5 text-sm outline-none focus:border-accent"
          />
          sec
        </label>
      ) : null}
      {children}
    </div>
  );
}
