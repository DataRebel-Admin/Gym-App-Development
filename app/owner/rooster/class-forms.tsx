"use client";

import { useActionState } from "react";
import {
  createClass,
  addSession,
  type ClassFormState,
  type SessionFormState,
} from "./actions";

const inputClass =
  "rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-accent";

export function NewClassForm() {
  const [state, formAction, pending] = useActionState<ClassFormState, FormData>(
    createClass,
    {}
  );
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-sm text-neutral-700">
        Naam
        <input name="name" required placeholder="bv. Spinning" className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm text-neutral-700">
        Instructeur
        <input name="instructorName" placeholder="optioneel" className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm text-neutral-700">
        Max. deelnemers
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
        {pending ? "Toevoegen…" : "Nieuwe les"}
      </button>
      {state.error ? (
        <span className="w-full text-sm text-red-600">{state.error}</span>
      ) : null}
    </form>
  );
}

export function AddSessionForm({ classId }: { classId: string }) {
  const [state, formAction, pending] = useActionState<SessionFormState, FormData>(
    addSession,
    {}
  );
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="classId" value={classId} />
      <label className="flex flex-col gap-1 text-sm text-neutral-700">
        Start
        <input name="startsAt" type="datetime-local" required className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm text-neutral-700">
        Einde
        <input name="endsAt" type="datetime-local" required className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm text-neutral-700">
        Locatie
        <input name="location" placeholder="optioneel" className={inputClass} />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Inplannen…" : "Sessie inplannen"}
      </button>
      {state.error ? (
        <span className="w-full text-sm text-red-600">{state.error}</span>
      ) : null}
    </form>
  );
}
