"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { ShieldCheck } from "@/components/ui/icons";
import { setProgressPhotoPrivacy } from "@/app/account/actions";

/**
 * Privacy-schakelaar: mag de trainer mijn voortgangsfoto's bekijken? Default uit
 * — zonder toestemming ziet alleen het lid zelf de foto's. Aanzetten geeft de
 * trainer toegang tot de foto's én de vergelijkingen.
 */
export function PhotoPrivacyToggle({ initialAllow }: { initialAllow: boolean }) {
  const [allow, setAllow] = useState(initialAllow);
  const [, startTransition] = useTransition();

  function toggle() {
    const next = !allow;
    setAllow(next);
    const fd = new FormData();
    fd.set("allow", String(next));
    startTransition(() => {
      void setProgressPhotoPrivacy(fd);
    });
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface-1 p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
          <ShieldCheck className="size-5" />
        </span>
        <div>
          <p className="text-sm font-semibold text-neutral-900">
            Trainer mag mijn voortgangsfoto&apos;s bekijken
          </p>
          <p className="mt-0.5 text-sm text-neutral-500">
            Standaard uit. Alleen jij ziet je foto&apos;s; zet dit aan om je trainer
            toegang te geven tot je foto&apos;s en vergelijkingen.
          </p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={allow}
        aria-label="Trainer mag mijn voortgangsfoto's bekijken"
        onClick={toggle}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-ring",
          allow ? "bg-accent" : "bg-neutral-300"
        )}
      >
        <span
          className={cn(
            "inline-block size-5 transform rounded-full bg-white shadow transition-transform",
            allow ? "translate-x-5" : "translate-x-0.5"
          )}
        />
      </button>
    </div>
  );
}
