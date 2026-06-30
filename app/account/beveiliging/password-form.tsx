"use client";

import { useActionState, useState } from "react";
import { setPassword, type SecurityState } from "../security-actions";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { passwordStrength } from "@/lib/password-strength";
import { cn } from "@/lib/cn";

const BAR = ["bg-red-500", "bg-red-500", "bg-amber-500", "bg-green-500", "bg-green-600"];

export function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [state, action, pending] = useActionState<SecurityState, FormData>(setPassword, {});
  const [pw, setPw] = useState("");
  const strength = passwordStrength(pw);

  return (
    <form action={action} className="flex max-w-md flex-col gap-4">
      {hasPassword ? (
        <Field label="Huidig wachtwoord">
          <Input name="currentPassword" type="password" autoComplete="current-password" required />
        </Field>
      ) : null}
      <Field label={hasPassword ? "Nieuw wachtwoord" : "Wachtwoord instellen"}>
        <Input
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          value={pw}
          onChange={(e) => setPw(e.target.value)}
        />
      </Field>

      {pw ? (
        <div className="flex flex-col gap-1">
          <div className="flex gap-1">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 flex-1 rounded-full",
                  i < strength.score ? BAR[strength.score] : "bg-neutral-200"
                )}
              />
            ))}
          </div>
          <span className="text-xs text-neutral-500">{strength.label}</span>
        </div>
      ) : null}

      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-green-600">Wachtwoord opgeslagen ✓</p> : null}

      <Button type="submit" loading={pending} disabled={!strength.ok} className="self-start">
        {hasPassword ? "Wachtwoord wijzigen" : "Wachtwoord instellen"}
      </Button>
    </form>
  );
}
