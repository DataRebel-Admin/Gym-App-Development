"use client";

import { useActionState, useState } from "react";
import {
  updateTenant,
  updateBranding,
  type TenantFormState,
} from "../actions";
import { ColorInput } from "@/components/ui/color-input";

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
        className="self-start rounded-lg bg-accent-gradient px-4 py-2 text-sm font-semibold text-accent-foreground shadow-sm hover:shadow-accent disabled:opacity-50"
      >
        {pending ? "Opslaan…" : "Opslaan"}
      </button>
    </form>
  );
}

/**
 * Afbeelding-upload met live preview. Een geüpload bestand wint van het URL-veld
 * (zie `updateBranding`); zonder upload houdt het URL-veld de huidige waarde vast.
 */
function ImageUploadField({
  label,
  fileName,
  urlName,
  currentUrl,
  previewClass,
}: {
  label: string;
  fileName: string;
  urlName: string;
  currentUrl: string | null;
  previewClass: string;
}) {
  const [preview, setPreview] = useState<string | null>(currentUrl);

  return (
    <Field label={label}>
      <div className="flex items-center gap-3">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt=""
            className={`${previewClass} shrink-0 rounded-lg border border-neutral-200 bg-neutral-50 object-contain`}
          />
        ) : (
          <div className={`${previewClass} shrink-0 rounded-lg border border-dashed border-neutral-300`} />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <input
            type="file"
            name={fileName}
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              setPreview(file ? URL.createObjectURL(file) : currentUrl);
            }}
            className="text-sm text-neutral-700 file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-neutral-700 hover:file:bg-neutral-200"
          />
          <input
            name={urlName}
            defaultValue={currentUrl ?? ""}
            placeholder="of plak een URL…"
            className={`${inputClass} text-sm`}
          />
        </div>
      </div>
    </Field>
  );
}

export function TenantBrandingForm({ tenant }: { tenant: Tenant }) {
  const [state, formAction, pending] = useActionState(updateBranding, initial);
  return (
    <form action={formAction} className="flex max-w-lg flex-col gap-4">
      <input type="hidden" name="id" value={tenant.id} />
      <ColorInput
        name="accentColor"
        label="Accentkleur (primair)"
        defaultValue={tenant.accentColor ?? ""}
        placeholder="#E84B1F"
      />
      <ColorInput
        name="secondaryColor"
        label="Secundaire kleur"
        defaultValue={tenant.secondaryColor ?? ""}
        placeholder="#2563EB"
      />
      <ImageUploadField
        label="Logo"
        fileName="logoFile"
        urlName="logoUrl"
        currentUrl={tenant.logoUrl}
        previewClass="h-12 w-12"
      />
      <ImageUploadField
        label="Favicon"
        fileName="faviconFile"
        urlName="faviconUrl"
        currentUrl={tenant.faviconUrl}
        previewClass="h-8 w-8"
      />
      <Field label="Lettertype (CSS font-family, optioneel)">
        <input name="fontFamily" defaultValue={tenant.fontFamily ?? ""} placeholder="Inter, sans-serif" className={inputClass} />
      </Field>
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-lg bg-accent-gradient px-4 py-2 text-sm font-semibold text-accent-foreground shadow-sm hover:shadow-accent disabled:opacity-50"
      >
        {pending ? "Opslaan…" : "Huisstijl opslaan"}
      </button>
    </form>
  );
}
