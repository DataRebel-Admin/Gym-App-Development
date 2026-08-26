"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { MAX_REPEAT_WEEKS } from "@/lib/class-attendance";
import {
  createClass,
  updateClass,
  addSession,
  updateSession,
  type ClassFormState,
  type SessionFormState,
} from "./actions";

const inputClass =
  "rounded-lg border border-neutral-200 bg-surface-1 px-3 py-2 text-sm outline-none focus:border-accent";

export type ClassFormValues = {
  id: string;
  name: string;
  description: string | null;
  instructorName: string | null;
  maxParticipants: number;
};

function FormMessage({ state }: { state: { error?: string; success?: string } }) {
  if (state.error) return <span className="w-full text-sm text-red-600">{state.error}</span>;
  if (state.success) return <span className="w-full text-sm text-green-700">{state.success}</span>;
  return null;
}

function ClassFields({ t, values }: { t: ReturnType<typeof useTranslations>; values?: ClassFormValues }) {
  return (
    <>
      <label className="flex flex-col gap-1 text-sm text-neutral-700">
        {t("formName")}
        <input name="name" required defaultValue={values?.name} placeholder={t("namePlaceholder")} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm text-neutral-700">
        {t("formInstructor")}
        <input name="instructorName" defaultValue={values?.instructorName ?? ""} placeholder={t("optional")} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm text-neutral-700">
        {t("formMaxParticipants")}
        <input
          name="maxParticipants"
          type="number"
          min={1}
          max={200}
          defaultValue={values?.maxParticipants ?? 12}
          className={`${inputClass} w-28`}
        />
      </label>
      <label className="flex w-full flex-col gap-1 text-sm text-neutral-700">
        {t("formDescription")}
        <textarea
          name="description"
          rows={2}
          maxLength={1000}
          defaultValue={values?.description ?? ""}
          placeholder={t("optional")}
          className={inputClass}
        />
      </label>
    </>
  );
}

export function NewClassForm() {
  const t = useTranslations("owner.rooster");
  const [state, formAction, pending] = useActionState<ClassFormState, FormData>(createClass, {});
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <ClassFields t={t} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50"
      >
        {pending ? t("adding") : t("newClass")}
      </button>
      <FormMessage state={state} />
    </form>
  );
}

export function EditClassForm({ values }: { values: ClassFormValues }) {
  const t = useTranslations("owner.rooster");
  const [state, formAction, pending] = useActionState<ClassFormState, FormData>(updateClass, {});
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="id" value={values.id} />
      <ClassFields t={t} values={values} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50"
      >
        {pending ? t("saving") : t("save")}
      </button>
      <FormMessage state={state} />
    </form>
  );
}

export type SessionFormValues = {
  id: string;
  /** Klok van de vestiging ("YYYY-MM-DDTHH:mm"), server-side omgezet met lib/tz. */
  startsAt: string;
  endsAt: string;
  locationId: string;
  location: string | null;
  maxParticipants: number | null;
};

function SessionFields({
  t,
  locations,
  defaultLocationId,
  values,
}: {
  t: ReturnType<typeof useTranslations>;
  locations: { id: string; name: string }[];
  defaultLocationId: string;
  values?: SessionFormValues;
}) {
  return (
    <>
      <label className="flex flex-col gap-1 text-sm text-neutral-700">
        {t("formStart")}
        <input name="startsAt" type="datetime-local" required defaultValue={values?.startsAt} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm text-neutral-700">
        {t("formEnd")}
        <input name="endsAt" type="datetime-local" required defaultValue={values?.endsAt} className={inputClass} />
      </label>
      {locations.length > 1 ? (
        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          {t("formVenue")}
          <select name="locationId" defaultValue={values?.locationId ?? defaultLocationId} className={inputClass}>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <input type="hidden" name="locationId" value={values?.locationId ?? defaultLocationId} />
      )}
      <label className="flex flex-col gap-1 text-sm text-neutral-700">
        {t("formLocation")}
        <input name="location" defaultValue={values?.location ?? ""} placeholder={t("optional")} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm text-neutral-700">
        {t("formMaxOverride")}
        <input
          name="maxParticipants"
          type="number"
          min={1}
          max={200}
          defaultValue={values?.maxParticipants ?? ""}
          placeholder={t("optional")}
          className={`${inputClass} w-28`}
        />
      </label>
    </>
  );
}

export function AddSessionForm({
  classId,
  locations,
  defaultLocationId,
}: {
  classId: string;
  /** Vestigingen waar deze gebruiker mag plannen (scope-gefilterd). */
  locations: { id: string; name: string }[];
  defaultLocationId: string;
}) {
  const t = useTranslations("owner.rooster");
  const [state, formAction, pending] = useActionState<SessionFormState, FormData>(addSession, {});
  const [repeat, setRepeat] = useState(0);
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="classId" value={classId} />
      <SessionFields t={t} locations={locations} defaultLocationId={defaultLocationId} />
      <label className="flex flex-col gap-1 text-sm text-neutral-700">
        {t("formRepeat")}
        <select
          name="repeatWeeks"
          value={repeat}
          onChange={(e) => setRepeat(Number(e.target.value))}
          className={inputClass}
        >
          <option value={0}>{t("noRepeat")}</option>
          {Array.from({ length: MAX_REPEAT_WEEKS }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {t("repeatWeeks", { count: n })}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50"
      >
        {pending ? t("scheduling") : t("scheduleSession")}
      </button>
      <FormMessage state={state} />
    </form>
  );
}

export function EditSessionForm({
  classId,
  locations,
  values,
}: {
  classId: string;
  locations: { id: string; name: string }[];
  values: SessionFormValues;
}) {
  const t = useTranslations("owner.rooster");
  const [state, formAction, pending] = useActionState<SessionFormState, FormData>(updateSession, {});
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="id" value={values.id} />
      <input type="hidden" name="classId" value={classId} />
      <SessionFields t={t} locations={locations} defaultLocationId={values.locationId} values={values} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50"
      >
        {pending ? t("saving") : t("save")}
      </button>
      <FormMessage state={state} />
    </form>
  );
}
