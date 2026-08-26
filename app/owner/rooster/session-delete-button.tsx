"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Modal } from "@/components/ui/modal";
import { Button, buttonClasses } from "@/components/ui/button";
import { deleteSession } from "./actions";

/**
 * Sessie verwijderen met bevestiging; bij een herhaalreeks kan de gebruiker
 * ook alle volgende sessies meenemen. Variant op `ConfirmButton` met één
 * extra veld (daarom niet hergebruikt).
 */
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
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-neutral-400 hover:text-red-600"
        aria-label={t("deleteSession")}
      >
        ✕
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={t("deleteSession")}>
        <p className="text-sm text-neutral-600">{t("deleteSessionConfirm")}</p>
        <form action={deleteSession} className="mt-4 flex flex-col gap-4">
          <input type="hidden" name="id" value={sessionId} />
          <input type="hidden" name="classId" value={classId} />
          {inSeries ? (
            <label className="flex items-center gap-2 text-sm text-neutral-700">
              <input type="checkbox" name="following" value="1" className="size-4 accent-accent" />
              {t("deleteFollowing")}
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
            <Button type="submit" variant="danger" size="sm">
              {tc("delete")}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
