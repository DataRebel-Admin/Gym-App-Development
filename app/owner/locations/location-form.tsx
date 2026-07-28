"use client";

import { useActionState } from "react";
import { saveLocation, type LocationFormState } from "./actions";
import { LOCATION_TIMEZONES } from "@/lib/location-timezones";

export type LocationFormData = {
  id: string;
  name: string;
  slug: string | null;
  addressLine: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  timezone: string;
};

const inputClass =
  "rounded-lg border border-border bg-surface-1 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-accent";

export function LocationForm({ location }: { location?: LocationFormData }) {
  const [state, formAction, pending] = useActionState<LocationFormState, FormData>(
    saveLocation,
    {}
  );

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-5">
      {location ? <input type="hidden" name="id" value={location.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          Naam *
          <input
            name="name"
            required
            defaultValue={location?.name}
            className={inputClass}
            placeholder="bv. Leeuwarden Centrum"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          Slug (optioneel)
          <input
            name="slug"
            defaultValue={location?.slug ?? ""}
            className={inputClass}
            placeholder="bv. centrum"
            pattern="[a-z0-9-]*"
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          Adres
          <input
            name="addressLine"
            defaultValue={location?.addressLine ?? ""}
            className={inputClass}
            placeholder="Straat + huisnummer"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          Postcode
          <input name="postalCode" defaultValue={location?.postalCode ?? ""} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          Plaats
          <input name="city" defaultValue={location?.city ?? ""} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          Land
          <input name="country" defaultValue={location?.country ?? ""} className={inputClass} />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          Telefoon
          <input name="contactPhone" defaultValue={location?.contactPhone ?? ""} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          E-mail
          <input
            name="contactEmail"
            type="email"
            defaultValue={location?.contactEmail ?? ""}
            className={inputClass}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm text-neutral-700">
        Tijdzone
        <select
          name="timezone"
          defaultValue={location?.timezone ?? "Europe/Amsterdam"}
          className={inputClass}
        >
          {LOCATION_TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
        <span className="text-xs text-neutral-500">
          Bepaalt de dag-/uurindeling van de vestigingsanalytics (bezetting, retentie).
        </span>
      </label>

      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Opslaan…" : "Opslaan"}
        </button>
      </div>
    </form>
  );
}
