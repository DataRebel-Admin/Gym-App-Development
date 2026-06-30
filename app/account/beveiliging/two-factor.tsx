"use client";

import { useActionState } from "react";
import { start2FA, confirm2FA, disable2FA, type SecurityState } from "../security-actions";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export function TwoFactor({ enabled }: { enabled: boolean }) {
  const [setup, startAction, starting] = useActionState<SecurityState, FormData>(start2FA, {});
  const [confirmState, confirmAction, confirming] = useActionState<SecurityState, FormData>(confirm2FA, {});

  if (enabled) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-green-700">
          ✓ Twee-factor-authenticatie is ingeschakeld.
        </p>
        <form action={disable2FA}>
          <Button type="submit" variant="outline" size="sm">
            2FA uitschakelen
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {!setup.qr ? (
        <form action={startAction}>
          <Button type="submit" variant="outline" loading={starting}>
            2FA instellen
          </Button>
        </form>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-neutral-600">
            Scan de QR-code met je authenticator-app (of voer de sleutel handmatig in)
            en bevestig met de 6-cijferige code.
          </p>
          <div className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={setup.qr} alt="2FA QR-code" className="size-40 rounded-xl border border-border" />
            <code className="break-all rounded-lg bg-neutral-100 px-2 py-1 text-xs text-neutral-700">
              {setup.secret}
            </code>
          </div>
          <form action={confirmAction} className="flex items-end gap-2">
            <Field label="Code uit app">
              <Input name="code" inputMode="numeric" autoComplete="one-time-code" placeholder="123456" className="w-32" />
            </Field>
            <Button type="submit" loading={confirming}>Bevestigen</Button>
          </form>
          {confirmState.error ? <p className="text-sm text-red-600">{confirmState.error}</p> : null}
        </div>
      )}
      {setup.error ? <p className="text-sm text-red-600">{setup.error}</p> : null}
    </div>
  );
}
