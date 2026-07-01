"use client";

import { useActionState } from "react";
import { setCustomQuotes, type ContactFormState } from "@/app/owner/settings/actions";

/**
 * Editor voor de eigen Workout Quotes van de sportschool: één quote per regel.
 * Ze worden getoond náást de standaard-quotes op het afrondscherm van het lid.
 */
export function QuotesForm({ initial }: { initial: string[] }) {
  const [state, formAction, pending] = useActionState<ContactFormState, FormData>(
    setCustomQuotes,
    {}
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm text-neutral-700">
        Eigen quotes (één per regel)
        <textarea
          name="quotes"
          rows={5}
          defaultValue={initial.join("\n")}
          placeholder={"Bijv. Vandaag geef je 1% extra.\nElke rep telt."}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <span className="text-xs text-neutral-400">
          Maximaal 50 quotes. Deze verschijnen willekeurig, samen met de standaardquotes.
        </span>
      </label>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Opslaan…" : "Quotes opslaan"}
        </button>
        {state.ok ? <span className="text-sm text-emerald-600">Opgeslagen</span> : null}
        {state.error ? <span className="text-sm text-red-600">{state.error}</span> : null}
      </div>
    </form>
  );
}
