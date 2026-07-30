"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import { addMember, type MemberFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

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
      <Field label="Naam" className="w-full sm:w-48">
        <Input name="name" placeholder="Voor- en achternaam" />
      </Field>
      <Field label="E-mail" className="w-full sm:w-64" required>
        <Input type="email" name="email" required placeholder="naam@voorbeeld.nl" />
      </Field>
      <Field label="Lidnummer" className="w-full sm:w-40">
        <Input name="memberNumber" placeholder="Bijv. FP-00123" maxLength={60} />
      </Field>
      {/* Geen rolkeuze: hier komen alleen sporters bij. Beheerders en
          medewerkers nodig je uit op /owner/staff (zie de hint onder de knop). */}
      {/* Standaard aan: zonder uitnodiging kan het lid nergens inloggen. */}
      <label className="flex items-center gap-2 pb-2.5 text-sm text-neutral-600">
        <input type="checkbox" name="invite" value="1" defaultChecked />
        Direct uitnodigen
      </label>
      <Button type="submit" loading={pending} className="w-full sm:w-auto">
        Lid toevoegen
      </Button>
      {state.error ? (
        <p className="w-full text-sm text-red-600">{state.error}</p>
      ) : state.notice ? (
        <p
          className={`w-full text-sm ${state.noticeTone === "success" ? "text-emerald-700" : "text-amber-700"}`}
        >
          {state.notice}
        </p>
      ) : null}
      <p className="w-full text-xs text-neutral-500">
        Iemand uit je team toevoegen? Dat doe je bij{" "}
        <Link href="/owner/staff" className="font-medium text-neutral-700 underline hover:text-neutral-900">
          Medewerkers
        </Link>
        , daar kies je tussen medewerker en beheerder.
      </p>
    </form>
  );
}
