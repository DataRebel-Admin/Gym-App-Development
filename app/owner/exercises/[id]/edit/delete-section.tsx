"use client";

import { useActionState, useState } from "react";
import { deleteCustomExercise, type CustomExerciseState } from "../../actions";

/**
 * Verwijder-knop met bevestiging die de blokkeer-foutmelding inline toont
 * (de server-action weigert verwijderen wanneer de oefening in gebruik is).
 */
export function DeleteCustomExercise({ id }: { id: string }) {
  const [state, formAction, pending] = useActionState<CustomExerciseState, FormData>(
    deleteCustomExercise,
    {}
  );
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="self-start rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
        >
          Oefening verwijderen
        </button>
        {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      <p className="text-sm text-neutral-700">
        Weet je zeker dat je deze oefening definitief wilt verwijderen?
      </p>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {pending ? "Verwijderen…" : "Ja, verwijderen"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          Annuleren
        </button>
      </div>
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
    </form>
  );
}
