"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { MapPin } from "@/components/ui/icons";
import { setActiveLocation } from "@/app/account/location-actions";

type LocationOption = { id: string; name: string };

/**
 * Kies de actieve vestiging voor dit apparaat. Alleen gerenderd bij een
 * multi-vestiging-organisatie (single-location merkt hier niets van). De keuze
 * gaat via een server action naar de device-cookie; `router.refresh()` laat de
 * server de resolutie (en dus de sessie-start) direct volgen.
 */
export function LocationSwitcher({
  locations,
  activeId,
  label,
}: {
  locations: LocationOption[];
  activeId: string;
  label: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (locations.length < 2) return null;

  return (
    <label className="flex items-center gap-2 rounded-2xl border border-border bg-surface-1 px-4 py-3">
      <MapPin className="size-4 shrink-0 text-accent" />
      <span className="text-sm font-medium text-neutral-700">{label}</span>
      <select
        value={activeId}
        disabled={pending}
        onChange={(e) => {
          const id = e.target.value;
          startTransition(async () => {
            await setActiveLocation(id);
            router.refresh();
          });
        }}
        className="ml-auto min-w-0 rounded-xl border border-border bg-surface-2 px-3 py-1.5 text-sm font-semibold text-neutral-900 disabled:opacity-60"
      >
        {locations.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
    </label>
  );
}
