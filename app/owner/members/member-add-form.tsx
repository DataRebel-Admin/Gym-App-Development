"use client";

import { useActionState, useEffect, useRef } from "react";
import { addMember, type MemberFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";

const initial: MemberFormState = {};

export function MemberAddForm() {
  const [state, formAction, pending] = useActionState(addMember, initial);
  const formRef = useRef<HTMLFormElement>(null);

  // Reset het formulier na een succesvolle toevoeging (geen error).
  useEffect(() => {
    if (!pending && !state.error) formRef.current?.reset();
  }, [pending, state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3">
      <Field label="Naam" className="w-48">
        <Input name="name" placeholder="Voor- en achternaam" />
      </Field>
      <Field label="E-mail" className="w-64" required>
        <Input type="email" name="email" required placeholder="naam@voorbeeld.nl" />
      </Field>
      <Field label="Rol" className="w-40">
        <Select name="role" defaultValue="TENANT_MEMBER">
          <option value="TENANT_MEMBER">Lid</option>
          <option value="TENANT_ADMIN">Beheerder</option>
        </Select>
      </Field>
      <Button type="submit" loading={pending}>
        Lid toevoegen
      </Button>
      {state.error ? (
        <p className="w-full text-sm text-red-600">{state.error}</p>
      ) : null}
    </form>
  );
}
