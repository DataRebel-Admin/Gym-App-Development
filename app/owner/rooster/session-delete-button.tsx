"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Modal } from "@/components/ui/modal";
import { Button, buttonClasses } from "@/components/ui/button";
import { cancelSession, deleteSession } from "./actions";

/**
 * Gedeelde bevestigingsmodal voor de twee sessie-acties met een reeks-optie:
 * verwijderen (weg, incl. aanmeldingen) en annuleren (gaat niet door, lijst
 * blijft — terug te draaien). Variant op `ConfirmButton` met één extra veld
 * (daarom niet hergebruikt).
 */
function SessionActionButton({
  sessionId,
  classId,
  inSeries,
  action,
  trigger,
  triggerLabel,
  title,
  message,
  followingLabel,
  confirmLabel,
  confirmVariant,
}: {
  sessionId: string;
  classId: string;
  inSeries: boolean;
  action: (formData: FormData) => void;
  trigger: ReactNode;
  triggerLabel: string;
  title: string;
  message: string;
  followingLabel: string;
  confirmLabel: string;
  confirmVariant: "danger" | "primary";
}) {
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-neutral-400 hover:text-red-600"
        aria-label={triggerLabel}
      >
        {trigger}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={title}>
        <p className="text-sm text-neutral-600">{message}</p>
        <form action={action} className="mt-4 flex flex-col gap-4">
          <input type="hidden" name="id" value={sessionId} />
          <input type="hidden" name="classId" value={classId} />
          {inSeries ? (
            <label className="flex items-center gap-2 text-sm text-neutral-700">
              <input type="checkbox" name="following" value="1" className="size-4 accent-accent" />
              {followingLabel}
            </label>
          ) : null}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className={buttonClasses({ variant: "outline", size: "sm" })}
            >
              {tc("cancel")}
            </button>
            <Button type="submit" variant={confirmVariant} size="sm">
              {confirmLabel}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export function SessionDeleteButton({
  sessionId,
  classId,
  inSeries,
}: {
  sessionId: string;
  classId: string;
  inSeries: boolean;
}) {
  const t = useTranslations("owner.rooster");
  const tc = useTranslations("common");
  return (
    <SessionActionButton
      sessionId={sessionId}
      classId={classId}
      inSeries={inSeries}
      action={deleteSession}
      trigger="✕"
      triggerLabel={t("deleteSession")}
      title={t("deleteSession")}
      message={t("deleteSessionConfirm")}
      followingLabel={t("deleteFollowing")}
      confirmLabel={tc("delete")}
      confirmVariant="danger"
    />
  );
}

/** Annuleren zonder verwijderen: aanmeldlijst blijft, terugdraaien kan. */
export function SessionCancelButton({
  sessionId,
  classId,
  inSeries,
}: {
  sessionId: string;
  classId: string;
  inSeries: boolean;
}) {
  const t = useTranslations("owner.rooster");
  return (
    <SessionActionButton
      sessionId={sessionId}
      classId={classId}
      inSeries={inSeries}
      action={cancelSession}
      trigger="🚫"
      triggerLabel={t("cancelSession")}
      title={t("cancelSession")}
      message={t("cancelSessionConfirm")}
      followingLabel={t("cancelFollowing")}
      confirmLabel={t("cancelSession")}
      confirmVariant="danger"
    />
  );
}
