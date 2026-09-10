"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { Dumbbell } from "@/components/ui/icons";
import { setStaffTrainsAsMember } from "@/app/owner/staff/actions";

/**
 * Lid-modus per teamlid: sport deze eigenaar/medewerker ook zelf bij deze
 * sportschool? Aan = de member-area staat voor dat account open op de eigen
 * trainingsdata, met een keuze bij het openen van de app.
 *
 * Optimistisch (patroon components/account/timer-toggle.tsx): de server-action
 * revalideert de pagina, dus een mislukte schrijfactie corrigeert zichzelf.
 */
export function TrainsAsMemberToggle({
  userId,
  enabled,
  self,
}: {
  userId: string;
  enabled: boolean;
  /** Toont "(jijzelf)" — de eigenaar zet 'm hier ook voor zichzelf aan. */
  self?: boolean;
}) {
  const [on, setOn] = useState(enabled);
  const [, startTransition] = useTransition();

  function toggle() {
    const next = !on;
    setOn(next);
    const fd = new FormData();
    fd.set("userId", userId);
    fd.set("enabled", next ? "1" : "0");
    startTransition(() => {
      void setStaffTrainsAsMember(fd);
    });
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl bg-surface-2 px-4 py-3">
      <div className="flex min-w-0 items-start gap-3">
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors",
            on ? "bg-accent-soft text-accent" : "bg-surface-1 text-neutral-400"
          )}
        >
          <Dumbbell className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-neutral-900">
            Sport hier zelf ook{self ? " (jijzelf)" : ""}
          </p>
          <p className="mt-0.5 text-xs text-neutral-500">
            Geeft toegang tot de sporter-omgeving op het eigen e-mailadres. Bij het
            openen van de app kiest {self ? "je" : "dit teamlid"} tussen trainen en
            beheren. Telt niet mee als lid in de ledenlijst of de cijfers.
          </p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Sport hier zelf ook"
        onClick={toggle}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-ring",
          on ? "bg-accent" : "bg-neutral-300"
        )}
      >
        <span
          className={cn(
            "inline-block size-5 transform rounded-full bg-white shadow transition-transform",
            on ? "translate-x-5" : "translate-x-0.5"
          )}
        />
      </button>
    </div>
  );
}
