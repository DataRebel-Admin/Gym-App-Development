"use client";

import { useActionState } from "react";
import { editMember, type MemberFormState } from "../actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";

const initial: MemberFormState = {};

export function MemberEditForm({
  member,
}: {
  member: { id: string; name: string | null; role: string };
}) {
  const [state, formAction, pending] = useActionState(editMember, initial);

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-4">
      <input type="hidden" name="userId" value={member.id} />
      <Field label="Naam">
        <Input name="name" defaultValue={member.name ?? ""} placeholder="Voor- en achternaam" />
      </Field>
      <Field label="Rol">
        <Select name="role" defaultValue={member.role}>
          <option value="TENANT_MEMBER">Lid</option>
          <option value="TENANT_ADMIN">Beheerder</option>
        </Select>
      </Field>
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <Button type="submit" loading={pending} className="self-start">
        Opslaan
      </Button>
    </form>
  );
}
