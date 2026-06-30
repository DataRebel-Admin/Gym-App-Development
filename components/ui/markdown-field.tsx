"use client";

import { useId, useState } from "react";
import Markdown from "react-markdown";

const inputClass =
  "rounded-lg border border-border bg-surface-1 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-accent";

const proseClass =
  "prose prose-sm prose-neutral max-w-none [&_h2]:mt-0 [&_h2]:text-base [&_h2]:font-semibold [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5";

/**
 * Herbruikbaar Markdown-tekstveld met live voorbeeld. Eén bron voor de
 * rich-text invoer in de app (machine-instructies, eigen-oefening-velden):
 * vrije Markdown met een nette, gerenderde preview eronder.
 */
export function MarkdownField({
  name,
  label,
  defaultValue = "",
  rows = 5,
  placeholder,
  hint,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  rows?: number;
  placeholder?: string;
  hint?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const id = useId();

  return (
    <div className="flex flex-col gap-1 text-sm text-neutral-700">
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      {hint ? <span className="text-xs text-neutral-500">{hint}</span> : null}
      <textarea
        id={id}
        name={name}
        rows={rows}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className={`${inputClass} font-mono`}
      />
      {value.trim() ? (
        <div className="mt-2 rounded-lg border border-border bg-surface-2 px-4 py-3">
          <p className="mb-2 text-xs uppercase tracking-wide text-neutral-500">
            Voorbeeld
          </p>
          <div className={proseClass}>
            <Markdown>{value}</Markdown>
          </div>
        </div>
      ) : null}
    </div>
  );
}
