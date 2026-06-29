"use client";

import { useActionState } from "react";
import {
  updateTenant,
  updateBranding,
  type TenantFormState,
} from "../actions";

const initial: TenantFormState = {};

type Tenant = {
  id: string;
  name: string;
  locale: string;
  accentColor: string | null;
  secondaryColor: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  fontFamily: string | null;
};

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
      {label}
      {children}
    </label>
  );
}

const inputClass =
  "rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900";

export function TenantEditForm({ tenant }: { tenant: Tenant }) {
  const [state, formAction, pending] = useActionState(updateTenant, initial);
  return (
    <form action={formAction} className="flex max-w-lg flex-col gap-4">
      <input type="hidden" name="id" value={tenant.id} />
      <Field label="Naam">
        <input name="name" defaultValue={tenant.name} required className={inputClass} />
      </Field>
      <Field label="Taal">
        <select name="locale" defaultValue={tenant.locale} className={inputClass}>
          <option value="NL">Nederlands</option>
          <option value="EN">Engels</option>
          <option value="FY">Frysk</option>
        </select>
      </Field>
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Opslaan…" : "Opslaan"}
      </button>
    </form>
  );
}

export function TenantBrandingForm({ tenant }: { tenant: Tenant }) {
  const [state, formAction, pending] = useActionState(updateBranding, initial);
  return (
    <form action={formAction} className="flex max-w-lg flex-col gap-4">
      <input type="hidden" name="id" value={tenant.id} />
      <Field label="Accentkleur (primair, hex)">
        <input name="accentColor" defaultValue={tenant.accentColor ?? ""} placeholder="#E84B1F" className={`${inputClass} font-mono text-sm`} />
      </Field>
      <Field label="Secundaire kleur (hex)">
        <input name="secondaryColor" defaultValue={tenant.secondaryColor ?? ""} placeholder="#2563EB" className={`${inputClass} font-mono text-sm`} />
      </Field>
      <Field label="Logo-URL">
        <input name="logoUrl" defaultValue={tenant.logoUrl ?? ""} placeholder="https://…" className={inputClass} />
      </Field>
      <Field label="Favicon-URL">
        <input name="faviconUrl" defaultValue={tenant.faviconUrl ?? ""} placeholder="https://…" className={inputClass} />
      </Field>
      <Field label="Lettertype (CSS font-family, optioneel)">
        <input name="fontFamily" defaultValue={tenant.fontFamily ?? ""} placeholder="Inter, sans-serif" className={inputClass} />
      </Field>
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Opslaan…" : "Huisstijl opslaan"}
      </button>
    </form>
  );
}
