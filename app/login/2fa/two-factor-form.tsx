"use client";

import { useActionState } from "react";
import { verifyTwoFactor, type LoginState } from "../actions";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export function TwoFactorForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(verifyTwoFactor, {});

  return (
    <form action={action} className="flex w-full flex-col gap-4">
      <Field
        label="Authenticatiecode"
        error={state.error}
        hint="Voer de 6-cijferige code uit je authenticator-app in."
      >
        <Input
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          required
          placeholder="123456"
          className="py-3 text-center text-base tracking-[0.4em]"
        />
      </Field>
      <Button type="submit" size="lg" loading={pending} className="mt-1 w-full">
        {pending ? "Controleren…" : "Verifiëren"}
      </Button>
    </form>
  );
}
