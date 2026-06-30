"use client";

import { useActionState } from "react";
import { createTenant, type TenantFormState } from "../actions";

const initial: TenantFormState = {};

export function TenantCreateForm() {
  const [state, formAction, pending] = useActionState(createTenant, initial);

  return (
    <form action={formAction} className="flex max-w-lg flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        Naam
        <input
          name="name"
          required
          placeholder="FitPower Leeuwarden"
          className="rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        Slug (subdomein)
        <input
          name="slug"
          required
          placeholder="fitpower"
          className="rounded-lg border border-neutral-300 px-3 py-2 font-mono text-sm text-neutral-900"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        Taal
        <select
          name="locale"
          defaultValue="NL"
          className="rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900"
        >
          <option value="NL">Nederlands</option>
          <option value="EN">Engels</option>
          <option value="FY">Frysk</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        Accentkleur (optioneel)
        <input
          name="accentColor"
          placeholder="#E84B1F"
          className="rounded-lg border border-neutral-300 px-3 py-2 font-mono text-sm text-neutral-900"
        />
      </label>

      {state.error ? (
        <p className="text-sm text-red-600">{state.error}</p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-accent-gradient px-4 py-2 text-sm font-semibold text-accent-foreground shadow-sm hover:shadow-accent disabled:opacity-50"
      >
        {pending ? "Aanmaken…" : "Tenant aanmaken"}
      </button>
    </form>
  );
}
