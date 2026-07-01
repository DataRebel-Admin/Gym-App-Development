"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { submitRequest, type RequestFormState } from "@/app/member/requests/actions";
import { GOAL_OPTIONS } from "@/lib/schema-requests";
import { Check } from "@/components/ui/icons";

const fieldClass =
  "w-full rounded-xl border border-border bg-surface-0 px-3 py-2.5 text-sm text-neutral-900 outline-none focus:border-accent";

/**
 * Compact aanvraagformulier voor een (nieuw/aangepast) trainingsschema. Toont na
 * verzending een nette succesmelding; bij een lopende aanvraag of fout een
 * duidelijke melding van de server-action.
 */
export function SchemaRequestForm({ canSubmit }: { canSubmit: boolean }) {
  const t = useTranslations("member.requests");
  const tr = useTranslations("requests");
  const [state, formAction, pending] = useActionState<RequestFormState, FormData>(
    submitRequest,
    {}
  );
  const [goal, setGoal] = useState<string>("MUSCLE");

  if (state.ok) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-accent/30 bg-accent-soft px-4 py-4">
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Check className="size-4" />
        </span>
        <div>
          <p className="font-display font-bold text-neutral-900">{t("successTitle")}</p>
          <p className="mt-0.5 text-sm text-neutral-600">{t("successBody")}</p>
        </div>
      </div>
    );
  }

  if (!canSubmit) {
    return (
      <div className="rounded-2xl border border-border bg-surface-1 px-4 py-4 text-sm text-neutral-600">
        {t("alreadyPending")}
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-2xl border border-border bg-surface-1 p-4">
      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        {t("goalLabel")}
        <select name="goal" value={goal} onChange={(e) => setGoal(e.target.value)} className={fieldClass}>
          {GOAL_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{tr(`goal${o.value}`)}</option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        {t("descLabel")}
        <textarea
          name="description"
          rows={3}
          maxLength={2000}
          placeholder={t("descPlaceholder")}
          className={fieldClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        {t("startLabel")} <span className="font-normal text-neutral-400">{t("optional")}</span>
        <input type="date" name="preferredStart" className={fieldClass} />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        {t("notesLabel")} <span className="font-normal text-neutral-400">{t("optional")}</span>
        <textarea
          name="notes"
          rows={2}
          maxLength={2000}
          placeholder={t("notesPlaceholder")}
          className={fieldClass}
        />
      </label>

      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-accent px-5 py-3 text-sm font-bold text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? t("submitting") : t("submit")}
      </button>
    </form>
  );
}
