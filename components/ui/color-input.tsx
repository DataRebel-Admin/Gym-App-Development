"use client";

import { useId, useState } from "react";

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/**
 * Kleurpicker: een native swatch (`<input type="color">`) gekoppeld aan een
 * hex-tekstveld. Beide blijven gesynchroniseerd; alleen de tekst-input draagt de
 * `name` zodat de form-action de hex-string ontvangt (en leeg mag zijn = "geen kleur").
 */
export function ColorInput({
  name,
  label,
  defaultValue = "",
  placeholder = "#E84B1F",
}: {
  name: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const valid = HEX_RE.test(value);
  const swatchId = useId();

  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
      {label}
      <div className="flex items-center gap-2">
        <input
          id={swatchId}
          type="color"
          aria-label={`${label} kiezen`}
          value={valid ? value : "#000000"}
          onChange={(e) => setValue(e.target.value)}
          className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-neutral-300 bg-white p-1"
        />
        <input
          name={name}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          spellCheck={false}
          className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 font-mono text-sm uppercase text-neutral-900"
        />
      </div>
    </label>
  );
}
