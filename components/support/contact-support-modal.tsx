"use client";

import { useEffect, useRef } from "react";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Textarea, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { LifeBuoy } from "@/components/ui/icons";
import { SUPPORT_CATEGORIES, SUPPORT_PRIORITIES } from "@/lib/support";
import {
  sendSupportMessage,
  logSupportOpened,
  type SupportFormState,
} from "@/app/owner/support/actions";

export type SupportInitial = {
  name: string;
  email: string;
  gymName: string;
};

/**
 * Contactformulier-modal ("Contact opnemen"). Naam/e-mail/sportschool worden
 * automatisch ingevuld (read-only; de server leidt de echte waarden af). Inline
 * validatie, loading-state en een duidelijke succes-toast. Bij openen wordt een
 * audit-regel geschreven (best-effort).
 */
export function ContactSupportModal({
  open,
  onClose,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  initial: SupportInitial;
}) {
  const t = useTranslations("owner.support");
  const toast = useToast();
  const [state, formAction, pending] = useActionState<SupportFormState, FormData>(
    sendSupportMessage,
    {}
  );
  const loggedOpen = useRef(false);

  // Log "geopend" één keer per opening (best-effort, niet-blokkerend).
  useEffect(() => {
    if (open && !loggedOpen.current) {
      loggedOpen.current = true;
      void logSupportOpened().catch(() => {});
    }
    if (!open) loggedOpen.current = false;
  }, [open]);

  // Succes → toast tonen en de modal sluiten.
  useEffect(() => {
    if (state.ok) {
      toast.success(t("successToast"));
      onClose();
    }
  }, [state.ok, toast, t, onClose]);

  return (
    <Modal open={open} onClose={onClose} title={t("title")} className="max-w-lg">
      <div className="mb-4 flex items-start gap-3 rounded-xl border border-border bg-surface-1 p-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-gradient text-accent-foreground">
          <LifeBuoy size={18} />
        </span>
        <p className="text-sm text-neutral-600">{t("intro")}</p>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("name")}>
            <Input value={initial.name} readOnly disabled />
          </Field>
          <Field label={t("email")}>
            <Input value={initial.email} readOnly disabled />
          </Field>
        </div>
        <Field label={t("gym")}>
          <Input value={initial.gymName} readOnly disabled />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("category")}>
            <Select name="category" defaultValue="general">
              {SUPPORT_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {t(`categories.${c.value}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("priority")}>
            <Select name="priority" defaultValue="normal">
              {SUPPORT_PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>
                  {t(`priorities.${p.value}`)}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label={t("subject")} required>
          <Input
            name="subject"
            required
            minLength={3}
            maxLength={150}
            placeholder={t("subjectPlaceholder")}
          />
        </Field>

        <Field label={t("message")} required hint={t("messageHint")}>
          <Textarea
            name="message"
            required
            minLength={10}
            maxLength={5000}
            rows={6}
            placeholder={t("messagePlaceholder")}
          />
        </Field>

        {state.error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </p>
        ) : null}

        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            {t("cancel")}
          </Button>
          <Button type="submit" loading={pending}>
            {t("send")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
