"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  saveProfile,
  updateAvatar,
  requestEmailChange,
  type AccountFormState,
} from "./actions";
import { Field, Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

const empty: AccountFormState = {};

const TIMEZONES = [
  "Europe/Amsterdam",
  "Europe/Brussels",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Istanbul",
  "UTC",
  "America/New_York",
  "America/Los_Angeles",
];

type Profile = {
  email: string;
  pendingEmail: string | null;
  emailVerified: boolean;
  firstName: string | null;
  lastName: string | null;
  jobTitle: string | null;
  phone: string | null;
  timezone: string | null;
  locale: string | null;
  image: string | null;
  name: string | null;
};

function Avatar({ image, name, email }: { image: string | null; name: string | null; email: string }) {
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={image} alt="" className="size-16 rounded-full object-cover" />;
  }
  const initial = (name ?? email).charAt(0).toUpperCase();
  return (
    <span className="flex size-16 items-center justify-center rounded-full bg-accent-gradient text-xl font-bold text-accent-foreground">
      {initial}
    </span>
  );
}

export function ProfileForm({ user }: { user: Profile }) {
  // --- Profielvelden (autosave, debounce op wijzigingen) ---
  const [state, save, saving] = useActionState(saveProfile, empty);
  const [tick, setTick] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  function onChange() {
    setTick((t) => t + 1);
  }
  useEffect(() => {
    if (tick === 0) return;
    const t = setTimeout(() => formRef.current?.requestSubmit(), 900);
    return () => clearTimeout(t);
  }, [tick]);

  // --- Avatar + e-mail ---
  const [avatarState, uploadAvatarAction, uploading] = useActionState(updateAvatar, empty);
  const [emailState, changeEmail, changingEmail] = useActionState(requestEmailChange, empty);

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="font-display text-2xl font-bold text-neutral-900">Profiel</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Beheer je persoonlijke gegevens. Wijzigingen worden automatisch opgeslagen.
        </p>
      </header>

      {/* Avatar */}
      <section className="flex items-center gap-5 rounded-2xl border border-border bg-surface-1 p-5">
        <Avatar image={user.image} name={user.name} email={user.email} />
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-neutral-900">Profielfoto</p>
          <form action={uploadAvatarAction} className="flex items-center gap-2">
            <input
              type="file"
              name="avatar"
              accept="image/*"
              className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-900 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-neutral-700"
            />
            <Button type="submit" size="sm" variant="outline" loading={uploading}>
              Uploaden
            </Button>
          </form>
          {avatarState.error ? <p className="text-xs text-red-600">{avatarState.error}</p> : null}
          {avatarState.ok ? <p className="text-xs text-green-600">Foto bijgewerkt ✓</p> : null}
        </div>
      </section>

      {/* Gegevens (autosave) */}
      <section className="flex flex-col gap-4 rounded-2xl border border-border bg-surface-1 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-900">Gegevens</h2>
          <span className="text-xs text-neutral-400" aria-live="polite">
            {saving ? "Opslaan…" : state.ok ? "Automatisch opgeslagen ✓" : state.error ? "" : ""}
          </span>
        </div>
        <form ref={formRef} action={save} onChange={onChange} className="grid gap-4 sm:grid-cols-2">
          <Field label="Voornaam">
            <Input name="firstName" defaultValue={user.firstName ?? ""} />
          </Field>
          <Field label="Achternaam">
            <Input name="lastName" defaultValue={user.lastName ?? ""} />
          </Field>
          <Field label="Functietitel" className="sm:col-span-2">
            <Input name="jobTitle" defaultValue={user.jobTitle ?? ""} placeholder="bv. Personal trainer" />
          </Field>
          <Field label="Telefoon">
            <Input name="phone" type="tel" defaultValue={user.phone ?? ""} placeholder="+31 6 …" />
          </Field>
          <Field label="Tijdzone">
            <Select name="timezone" defaultValue={user.timezone ?? "Europe/Amsterdam"}>
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </Select>
          </Field>
          <Field label="Taal">
            <Select name="locale" defaultValue={user.locale ?? ""}>
              <option value="">Volg sportschool</option>
              <option value="NL">Nederlands</option>
              <option value="EN">Engels</option>
              <option value="FY">Frysk</option>
            </Select>
          </Field>
          {state.error ? <p className="text-xs text-red-600 sm:col-span-2">{state.error}</p> : null}
        </form>
      </section>

      {/* E-mail (verificatie) */}
      <section className="flex flex-col gap-4 rounded-2xl border border-border bg-surface-1 p-5">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">E-mailadres</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Huidig: <span className="font-medium text-neutral-900">{user.email}</span>{" "}
            {user.emailVerified ? (
              <span className="text-green-600">· geverifieerd</span>
            ) : (
              <span className="text-amber-600">· niet geverifieerd</span>
            )}
          </p>
          {user.pendingEmail ? (
            <p className="mt-1 text-sm text-amber-600">
              Wijziging in afwachting: bevestig de link in de mail naar {user.pendingEmail}.
            </p>
          ) : null}
        </div>
        <form action={changeEmail} className="flex flex-wrap items-end gap-3">
          <Field label="Nieuw e-mailadres" className="w-72">
            <Input name="email" type="email" required placeholder="nieuw@voorbeeld.nl" />
          </Field>
          <Button type="submit" variant="outline" loading={changingEmail}>
            Verificatie versturen
          </Button>
        </form>
        {emailState.error ? <p className="text-xs text-red-600">{emailState.error}</p> : null}
        {emailState.ok ? (
          <p className="text-xs text-green-600">Verificatielink verstuurd — check je nieuwe inbox.</p>
        ) : null}
      </section>
    </div>
  );
}
