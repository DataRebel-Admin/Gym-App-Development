"use client";

import { useActionState } from "react";
import { editMember, type MemberFormState } from "../actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";

const initial: MemberFormState = {};

export function MemberEditForm({
  member,
}: {
  member: {
    id: string;
    name: string | null;
    email: string;
    role: string;
    memberNumber: string | null;
  };
}) {
  const [state, formAction, pending] = useActionState(editMember, initial);

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-4">
      <input type="hidden" name="userId" value={member.id} />
      <Field label="Naam">
        <Input name="name" defaultValue={member.name ?? ""} placeholder="Voor- en achternaam" />
      </Field>
      <Field label="E-mailadres" hint="Het lid logt voortaan in met dit adres.">
        <Input name="email" type="email" required defaultValue={member.email} placeholder="naam@voorbeeld.nl" />
      </Field>
      <Field
        label="Lidnummer"
        hint="Eigen klant-/lidnummer uit je administratie, uniek binnen de sportschool."
      >
        <Input
          name="memberNumber"
          defaultValue={member.memberNumber ?? ""}
          placeholder="Bijv. FP-00123"
          maxLength={60}
        />
      </Field>
      {/* De enige plek waar een sporter naar het team promoveert. Kies je hier
          medewerker of beheerder, dan verdwijnt de persoon uit de ledenlijst en
          verschijnt hij bij Medewerkers (daar staan ook de rechten). */}
      <Field
        label="Rol"
        hint="Medewerker of beheerder? Dan verhuist deze persoon naar Medewerkers."
      >
        <Select name="role" defaultValue={member.role}>
          <option value="TENANT_MEMBER">Lid</option>
          <option value="TENANT_STAFF">Medewerker</option>
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
