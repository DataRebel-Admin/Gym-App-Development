"use client";

import { useActionState } from "react";
import { requestMagicLink, type LoginState } from "./actions";

export function LoginForm({ tenant }: { tenant: string }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    requestMagicLink,
    {}
  );

  return (
    <form action={formAction} className="flex w-full flex-col gap-4">
      <input type="hidden" name="tenant" value={tenant} />

      <label className="flex flex-col gap-1 text-sm text-neutral-700">
        E-mailadres
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="jij@voorbeeld.nl"
          className="rounded-lg border border-neutral-200 bg-white px-4 py-3 text-base text-neutral-900 outline-none focus:border-accent"
        />
      </label>

      {state.error ? (
        <p className="text-sm text-red-600">{state.error}</p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-lg bg-accent px-4 py-3 text-base font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Versturen…" : "Stuur magic link"}
      </button>
    </form>
  );
}
