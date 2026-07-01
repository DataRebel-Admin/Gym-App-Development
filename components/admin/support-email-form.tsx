"use client";

import { useActionState } from "react";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import {
  updateSupportEmail,
  type SupportEmailState,
} from "@/app/admin/settings/actions";

/** Superadmin-form: het support-e-mailadres wijzigen (contactberichten owners). */
export function SupportEmailForm({ current }: { current: string }) {
  const [state, formAction, pending] = useActionState<SupportEmailState, FormData>(
    updateSupportEmail,
    {}
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field
        label="Support e-mailadres"
        hint="Contactberichten van sportschooleigenaren worden naar dit adres verstuurd."
        error={state.error}
      >
        <Input
          name="email"
          type="email"
          required
          defaultValue={current}
          placeholder="admin@datarebel.nl"
        />
      </Field>
      <div className="flex items-center gap-3">
        <Button type="submit" loading={pending} className="self-start">
          Opslaan
        </Button>
        {state.ok ? (
          <span className="text-sm text-green-700">Opgeslagen ✓</span>
        ) : null}
      </div>
    </form>
  );
}
