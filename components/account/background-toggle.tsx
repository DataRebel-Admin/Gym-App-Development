"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { MousePointer2 } from "@/components/ui/icons";
import { BG_PARALLAX_COOKIE } from "@/lib/constants";

/**
 * Voorkeur: reageert de aurora-achtergrond op je cursor? Zet — net als de
 * ThemeToggle — het attribuut op <html> (AppBackground luistert mee → meteen
 * zichtbaar, zonder herladen) én de cookie zodat de server het de volgende keer
 * no-flash toepast. Bewust geen server-action: de voorkeur geldt per apparaat
 * (parallax bestaat alleen op desktop mét muis).
 */
export function BackgroundParallaxToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    const value = next ? "on" : "off";
    document.documentElement.dataset.bgParallax = value;
    document.cookie = `${BG_PARALLAX_COOKIE}=${value}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface-1 p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
          <MousePointer2 className="size-5" />
        </span>
        <div>
          <p className="text-sm font-semibold text-neutral-900">Achtergrond volgt je muis</p>
          <p className="mt-0.5 text-sm text-neutral-500">
            De gekleurde achtergrond beweegt subtiel mee met je cursor. Zet je dit
            uit, dan blijft de achtergrond stil staan. Geldt op dit apparaat, en
            alleen op een computer met muis — op telefoon en tablet beweegt de
            achtergrond sowieso niet mee.
          </p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label="Achtergrond volgt je muis"
        onClick={toggle}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-ring",
          enabled ? "bg-accent" : "bg-neutral-300"
        )}
      >
        <span
          className={cn(
            "inline-block size-5 transform rounded-full bg-white shadow transition-transform",
            enabled ? "translate-x-5" : "translate-x-0.5"
          )}
        />
      </button>
    </div>
  );
}
