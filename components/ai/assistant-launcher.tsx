"use client";

import { useState } from "react";
import { AssistantPanel, type AssistantPanelProps } from "./assistant-panel";

export type AssistantLauncherProps = AssistantPanelProps & {
  title: string;
  subtitle?: string;
};

/**
 * Zwevende variant van de assistent (chat-bubble rechtsonder) — gebruikt in de
 * member-area. Deelt exact dezelfde `AssistantPanel` als de inline owner-varianten.
 */
export function AssistantLauncher({
  title,
  subtitle = "Geen medisch advies — bij twijfel: vraag een trainer.",
  ...panelProps
}: AssistantLauncherProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Sluit de assistent" : "Open de assistent"}
        className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-2xl text-accent-foreground shadow-lg active:opacity-90"
      >
        {open ? "✕" : "💬"}
      </button>

      {open ? (
        <div className="fixed inset-x-4 bottom-40 z-40 mx-auto flex max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-surface-1 shadow-lg">
          <div className="border-b border-border px-4 py-3">
            <p className="text-sm font-semibold text-neutral-900">{title}</p>
            <p className="text-xs text-neutral-500">{subtitle}</p>
          </div>
          <AssistantPanel {...panelProps} />
        </div>
      ) : null}
    </>
  );
}
