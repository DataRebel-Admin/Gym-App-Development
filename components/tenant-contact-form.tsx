"use client";

import { useActionState } from "react";
import { setTenantContact, type ContactFormState } from "@/app/owner/settings/actions";

export type ContactInitial = {
  addressLine: string;
  postalCode: string;
  city: string;
  country: string;
  contactPhone: string;
  contactEmail: string;
  website: string;
  hours: Record<string, string>;
  socials: Record<string, string>;
};

const DAYS: { key: string; label: string }[] = [
  { key: "mon", label: "Maandag" },
  { key: "tue", label: "Dinsdag" },
  { key: "wed", label: "Woensdag" },
  { key: "thu", label: "Donderdag" },
  { key: "fri", label: "Vrijdag" },
  { key: "sat", label: "Zaterdag" },
  { key: "sun", label: "Zondag" },
];
const SOCIALS: { key: string; label: string }[] = [
  { key: "instagram", label: "Instagram" },
  { key: "facebook", label: "Facebook" },
  { key: "twitter", label: "X / Twitter" },
  { key: "tiktok", label: "TikTok" },
  { key: "youtube", label: "YouTube" },
  { key: "linkedin", label: "LinkedIn" },
];

const input =
  "rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-accent";
const label = "flex flex-col gap-1 text-sm text-neutral-700";

export function TenantContactForm({ initial }: { initial: ContactInitial }) {
  const [state, formAction, pending] = useActionState<ContactFormState, FormData>(
    setTenantContact,
    {}
  );

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={`${label} sm:col-span-2`}>
          Adres
          <input name="addressLine" defaultValue={initial.addressLine} className={input} placeholder="Straat en huisnummer" />
        </label>
        <label className={label}>
          Postcode
          <input name="postalCode" defaultValue={initial.postalCode} className={input} />
        </label>
        <label className={label}>
          Plaats
          <input name="city" defaultValue={initial.city} className={input} />
        </label>
        <label className={label}>
          Land
          <input name="country" defaultValue={initial.country} className={input} />
        </label>
        <label className={label}>
          Telefoonnummer
          <input name="contactPhone" defaultValue={initial.contactPhone} className={input} placeholder="+31 …" />
        </label>
        <label className={label}>
          E-mailadres
          <input name="contactEmail" type="email" defaultValue={initial.contactEmail} className={input} />
        </label>
        <label className={label}>
          Website
          <input name="website" defaultValue={initial.website} className={input} placeholder="https://…" />
        </label>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-semibold text-neutral-900">Openingstijden</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {DAYS.map((d) => (
            <label key={d.key} className="flex items-center gap-2 text-sm text-neutral-700">
              <span className="w-24 shrink-0">{d.label}</span>
              <input
                name={`hours.${d.key}`}
                defaultValue={initial.hours[d.key] ?? ""}
                placeholder="06:00 - 22:00"
                className={`${input} flex-1`}
              />
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-semibold text-neutral-900">Social media</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {SOCIALS.map((s) => (
            <label key={s.key} className="flex items-center gap-2 text-sm text-neutral-700">
              <span className="w-24 shrink-0">{s.label}</span>
              <input
                name={`social.${s.key}`}
                defaultValue={initial.socials[s.key] ?? ""}
                placeholder="https://…"
                className={`${input} flex-1`}
              />
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Opslaan…" : "Contactgegevens opslaan"}
        </button>
        {state.ok ? <span className="text-sm text-green-700">Opgeslagen ✓</span> : null}
        {state.error ? <span className="text-sm text-red-600">{state.error}</span> : null}
      </div>
    </form>
  );
}
