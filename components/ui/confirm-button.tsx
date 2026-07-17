"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Modal } from "@/components/ui/modal";
import { Button, buttonClasses, type ButtonVariant } from "@/components/ui/button";

/**
 * Knop die een destructieve server-action pas uitvoert na expliciete bevestiging
 * in een modal. Vervangt een inline <form action=…> met directe submit.
 *
 * `confirmLabel`/`title` vallen terug op de vertaalde `common`-sleutels; geef ze
 * alleen mee als de actie een specifieker woord dan "Verwijderen" verdient.
 */
export function ConfirmButton({
  action,
  fields,
  label,
  confirmLabel,
  title,
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
  const t = useTranslations("common");
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
      <Modal open={open} onClose={() => setOpen(false)} title={title ?? t("confirmTitle")}>
        <p className="text-sm text-neutral-600">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className={buttonClasses({ variant: "outline", size: "sm" })}
          >
            {t("cancel")}
          </button>
          <form action={action}>
            {Object.entries(fields ?? {}).map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={v} />
            ))}
            <Button type="submit" variant={confirmVariant} size="sm">
              {confirmLabel ?? t("delete")}
            </Button>
          </form>
        </div>
      </Modal>
    </>
  );
}
