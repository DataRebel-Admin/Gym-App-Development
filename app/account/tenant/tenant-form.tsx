"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { saveTenantBusiness, type AccountFormState } from "../actions";
import { Field, Input } from "@/components/ui/field";

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
  { key: "linkedin", label: "LinkedIn" },
  { key: "tiktok", label: "TikTok" },
];

export type TenantBusiness = {
  contactEmail: string | null;
  contactPhone: string | null;
  addressLine: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  website: string | null;
  vatNumber: string | null;
  cocNumber: string | null;
  socials: Record<string, string> | null;
  openingHours: Record<string, string> | null;
};

function Section({ title, children, cols = 2 }: { title: string; children: React.ReactNode; cols?: number }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-surface-1 p-5">
      <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
      <div className={cols === 2 ? "grid gap-4 sm:grid-cols-2" : "grid gap-3"}>{children}</div>
    </section>
  );
}

export function TenantForm({ tenant }: { tenant: TenantBusiness }) {
  const [state, save, saving] = useActionState<AccountFormState, FormData>(saveTenantBusiness, {});
  const formRef = useRef<HTMLFormElement>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (tick === 0) return;
    const t = setTimeout(() => formRef.current?.requestSubmit(), 900);
    return () => clearTimeout(t);
  }, [tick]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-neutral-900">Sportschool</h1>
          <p className="mt-1 text-sm text-neutral-500">Zakelijke gegevens van je sportschool (autosave).</p>
        </div>
        <span className="text-xs text-neutral-400" aria-live="polite">
          {saving ? "Opslaan…" : state.ok ? "Opgeslagen ✓" : ""}
        </span>
      </header>

      <form ref={formRef} action={save} onChange={() => setTick((t) => t + 1)} className="flex flex-col gap-6">
        <Section title="Contact">
          <Field label="Contact-e-mail"><Input name="contactEmail" type="email" defaultValue={tenant.contactEmail ?? ""} /></Field>
          <Field label="Telefoon"><Input name="contactPhone" defaultValue={tenant.contactPhone ?? ""} /></Field>
          <Field label="Website" className="sm:col-span-2"><Input name="website" placeholder="https://…" defaultValue={tenant.website ?? ""} /></Field>
        </Section>

        <Section title="Adres">
          <Field label="Adres" className="sm:col-span-2"><Input name="addressLine" defaultValue={tenant.addressLine ?? ""} /></Field>
          <Field label="Postcode"><Input name="postalCode" defaultValue={tenant.postalCode ?? ""} /></Field>
          <Field label="Plaats"><Input name="city" defaultValue={tenant.city ?? ""} /></Field>
          <Field label="Land"><Input name="country" defaultValue={tenant.country ?? ""} /></Field>
        </Section>

        <Section title="Zakelijk">
          <Field label="BTW-nummer"><Input name="vatNumber" defaultValue={tenant.vatNumber ?? ""} /></Field>
          <Field label="KvK-nummer"><Input name="cocNumber" defaultValue={tenant.cocNumber ?? ""} /></Field>
        </Section>

        <Section title="Social media">
          {SOCIALS.map((s) => (
            <Field key={s.key} label={s.label}>
              <Input name={`social_${s.key}`} defaultValue={tenant.socials?.[s.key] ?? ""} placeholder="URL of handle" />
            </Field>
          ))}
        </Section>

        <Section title="Openingstijden" cols={1}>
          {DAYS.map((d) => (
            <div key={d.key} className="grid grid-cols-[110px_1fr] items-center gap-3">
              <label className="text-sm text-neutral-600" htmlFor={`hours_${d.key}`}>{d.label}</label>
              <Input id={`hours_${d.key}`} name={`hours_${d.key}`} defaultValue={tenant.openingHours?.[d.key] ?? ""} placeholder="bv. 06:00–22:00 of Gesloten" />
            </div>
          ))}
        </Section>

        {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      </form>
    </div>
  );
}
