"use client";

import { useActionState, useState } from "react";
import { requestMagicLink, loginWithPassword, oauthSignIn, type LoginState } from "./actions";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export function LoginForm({
  tenant,
  oauth,
}: {
  tenant: string;
  oauth?: { google: boolean; microsoft: boolean };
}) {
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

      {oauth?.google || oauth?.microsoft ? (
        <>
          <div className="flex items-center gap-3 py-1 text-xs text-neutral-400">
            <span className="h-px flex-1 bg-border" /> of <span className="h-px flex-1 bg-border" />
          </div>
          <div className="flex flex-col gap-2">
            {oauth.microsoft ? (
              <form action={oauthSignIn}>
                <input type="hidden" name="provider" value="microsoft-entra-id" />
                <input type="hidden" name="tenant" value={tenant} />
                <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface-1 px-4 py-2.5 text-sm font-medium text-neutral-900 hover:bg-neutral-50">
                  Inloggen met Microsoft
                </button>
              </form>
            ) : null}
            {oauth.google ? (
              <form action={oauthSignIn}>
                <input type="hidden" name="provider" value="google" />
                <input type="hidden" name="tenant" value={tenant} />
                <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface-1 px-4 py-2.5 text-sm font-medium text-neutral-900 hover:bg-neutral-50">
                  Inloggen met Google
                </button>
              </form>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
