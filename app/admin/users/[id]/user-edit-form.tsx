"use client";

import { useActionState } from "react";
import { updateUser, type UserEditState } from "../actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { ROLE_LABEL, TENANT_ROLES } from "../role-meta";

const initial: UserEditState = {};

export function UserEditForm({
  user,
  isSelf,
}: {
  user: {
    id: string;
    name: string | null;
    email: string;
    role: string;
    tenantId: string | null;
  };
  /** De ingelogde superadmin bewerkt zichzelf: rol is dan niet wijzigbaar. */
  isSelf: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateUser, initial);
  const hasTenantRole = user.tenantId !== null;

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-4">
      <input type="hidden" name="userId" value={user.id} />
      <Field label="Naam">
        <Input name="name" defaultValue={user.name ?? ""} placeholder="Voor- en achternaam" maxLength={120} />
      </Field>
      <Field
        label="E-mailadres"
        hint="De gebruiker logt voortaan in met dit adres. Er wordt geen verificatiemail gestuurd."
      >
        <Input name="email" type="email" required defaultValue={user.email} placeholder="naam@voorbeeld.nl" />
      </Field>
      {hasTenantRole ? (
        <Field
          label="Rol"
          hint={
            isSelf
              ? "Je eigen rol kun je niet wijzigen."
              : "Bepaalt wat deze persoon in de sportschool mag. Rechten per medewerker stelt de eigenaar zelf in."
          }
        >
          {/* key = rol: na een geslaagde wijziging remount de select met de verse
              waarde; anders houdt React de oude DOM-default vast. */}
          <Select key={user.role} name="role" defaultValue={user.role} disabled={isSelf}>
            {TENANT_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </Select>
        </Field>
      ) : (
        <p className="text-xs text-neutral-500">
          Superadmin is een platformrol zonder tenant; de rol is hier niet wijzigbaar.
        </p>
      )}
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state.ok && !state.error ? <p className="text-sm text-green-600">Opgeslagen.</p> : null}
      <Button type="submit" loading={pending} className="self-start">
        Opslaan
      </Button>
    </form>
  );
}
