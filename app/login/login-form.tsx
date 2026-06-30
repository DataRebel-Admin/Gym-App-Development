"use client";

import { useActionState, useState } from "react";
import { requestMagicLink, loginWithPassword, type LoginState } from "./actions";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export function LoginForm({ tenant }: { tenant: string }) {
  const [mode, setMode] = useState<"link" | "password">("link");
  const [linkState, linkAction, linkPending] = useActionState<LoginState, FormData>(requestMagicLink, {});
  const [pwState, pwAction, pwPending] = useActionState<LoginState, FormData>(loginWithPassword, {});

  return (
    <div className="flex w-full flex-col gap-4">
      {mode === "link" ? (
        <form action={linkAction} className="flex w-full flex-col gap-4">
          <input type="hidden" name="tenant" value={tenant} />
          <Field label="E-mailadres" error={linkState.error}>
            <Input name="email" type="email" required autoComplete="email" placeholder="jij@voorbeeld.nl" className="py-3 text-base" />
          </Field>
          <Button type="submit" size="lg" loading={linkPending} className="mt-2 w-full">
            {linkPending ? "Versturen…" : "Stuur magic link"}
          </Button>
        </form>
      ) : (
        <form action={pwAction} className="flex w-full flex-col gap-4">
          <input type="hidden" name="tenant" value={tenant} />
          <Field label="E-mailadres" error={pwState.error}>
            <Input name="email" type="email" required autoComplete="email" placeholder="jij@voorbeeld.nl" className="py-3 text-base" />
          </Field>
          <Field label="Wachtwoord">
            <Input name="password" type="password" required autoComplete="current-password" className="py-3 text-base" />
          </Field>
          <Field label="2FA-code (indien ingeschakeld)">
            <Input name="code" inputMode="numeric" autoComplete="one-time-code" placeholder="123456" className="py-3 text-base" />
          </Field>
          <Button type="submit" size="lg" loading={pwPending} className="mt-2 w-full">
            {pwPending ? "Inloggen…" : "Inloggen"}
          </Button>
        </form>
      )}

      <button
        type="button"
        onClick={() => setMode(mode === "link" ? "password" : "link")}
        className="text-center text-sm font-medium text-neutral-500 hover:text-neutral-900"
      >
        {mode === "link" ? "Inloggen met wachtwoord" : "Inloggen met magic link"}
      </button>
    </div>
  );
}
