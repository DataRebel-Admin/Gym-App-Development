"use client";

import { useActionState } from "react";
import { requestMagicLink, type LoginState } from "./actions";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export function LoginForm({ tenant }: { tenant: string }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    requestMagicLink,
    {}
  );

  return (
    <form action={formAction} className="flex w-full flex-col gap-4">
      <input type="hidden" name="tenant" value={tenant} />

      <Field label="E-mailadres" error={state.error}>
        <Input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="jij@voorbeeld.nl"
          className="py-3 text-base"
        />
      </Field>

      <Button type="submit" size="lg" loading={pending} className="mt-2 w-full">
        {pending ? "Versturen…" : "Stuur magic link"}
      </Button>
    </form>
  );
}
