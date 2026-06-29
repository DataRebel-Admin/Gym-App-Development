"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button, buttonClasses, type ButtonVariant } from "@/components/ui/button";

/**
 * Knop die een destructieve server-action pas uitvoert na expliciete bevestiging
 * in een modal. Vervangt een inline <form action=…> met directe submit.
 */
export function ConfirmButton({
  action,
  fields,
  label,
  confirmLabel = "Verwijderen",
  title = "Weet je het zeker?",
  message,
  triggerClassName,
  confirmVariant = "danger",
}: {
  action: (formData: FormData) => void | Promise<void>;
  fields?: Record<string, string>;
  label: string;
  confirmLabel?: string;
  title?: string;
  message: string;
  triggerClassName?: string;
  confirmVariant?: ButtonVariant;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          triggerClassName ??
          "rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
        }
      >
        {label}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={title}>
        <p className="text-sm text-neutral-600">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className={buttonClasses({ variant: "outline", size: "sm" })}
          >
            Annuleren
          </button>
          <form action={action}>
            {Object.entries(fields ?? {}).map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={v} />
            ))}
            <Button type="submit" variant={confirmVariant} size="sm">
              {confirmLabel}
            </Button>
          </form>
        </div>
      </Modal>
    </>
  );
}
