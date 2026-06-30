"use client";

import { useActionState, useEffect, useRef } from "react";
import { inviteUser, type InviteFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";

const initial: InviteFormState = {};

export function InviteUserForm({
  tenants,
}: {
  tenants: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(inviteUser, initial);
  const formRef = useRef<HTMLFormElement>(null);

  // Reset na een succesvolle uitnodiging.
  useEffect(() => {
    if (!pending && state.ok) formRef.current?.reset();
  }, [pending, state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3">
      <Field label="Tenant" className="w-full sm:w-56" required>
        <Select name="tenantId" defaultValue="" required>
          <option value="" disabled>
            Kies een tenant…
          </option>
          {tenants.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="E-mail" className="w-full sm:w-64" required>
        <Input type="email" name="email" required placeholder="naam@voorbeeld.nl" />
      </Field>
      <Field label="Rol" className="w-full sm:w-40">
        <Select name="role" defaultValue="TENANT_MEMBER">
          <option value="TENANT_MEMBER">Lid</option>
          <option value="TENANT_ADMIN">Beheerder</option>
        </Select>
      </Field>
      <Button type="submit" loading={pending} className="w-full sm:w-auto">
        Uitnodigen
      </Button>
      {state.error ? <p className="w-full text-sm text-red-600">{state.error}</p> : null}
      {state.ok ? (
        <p className="w-full text-sm text-green-600">Uitnodiging verzonden.</p>
      ) : null}
    </form>
  );
}
