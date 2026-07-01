"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import {
  createClass,
  addSession,
  type ClassFormState,
  type SessionFormState,
} from "./actions";

const inputClass =
  "rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-accent";

export function NewClassForm() {
  const t = useTranslations("owner.rooster");
  const [state, formAction, pending] = useActionState<ClassFormState, FormData>(
    createClass,
    {}
  );
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-sm text-neutral-700">
        {t("formName")}
        <input name="name" required placeholder={t("namePlaceholder")} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm text-neutral-700">
        {t("formInstructor")}
        <input name="instructorName" placeholder={t("optional")} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm text-neutral-700">
        {t("formMaxParticipants")}
        <input
          name="maxParticipants"
          type="number"
          min={1}
          defaultValue={12}
          className={`${inputClass} w-28`}
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50"
      >
        {pending ? t("adding") : t("newClass")}
      </button>
      {state.error ? (
        <span className="w-full text-sm text-red-600">{state.error}</span>
      ) : null}
    </form>
  );
}

export function AddSessionForm({ classId }: { classId: string }) {
  const t = useTranslations("owner.rooster");
  const [state, formAction, pending] = useActionState<SessionFormState, FormData>(
    addSession,
    {}
  );
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="classId" value={classId} />
      <label className="flex flex-col gap-1 text-sm text-neutral-700">
        {t("formStart")}
        <input name="startsAt" type="datetime-local" required className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm text-neutral-700">
        {t("formEnd")}
        <input name="endsAt" type="datetime-local" required className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm text-neutral-700">
        {t("formLocation")}
        <input name="location" placeholder={t("optional")} className={inputClass} />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50"
      >
        {pending ? t("scheduling") : t("scheduleSession")}
      </button>
      {state.error ? (
        <span className="w-full text-sm text-red-600">{state.error}</span>
      ) : null}
    </form>
  );
}
