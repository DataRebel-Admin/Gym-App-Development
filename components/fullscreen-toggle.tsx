"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Maximize, Minimize } from "lucide-react";
import { cn } from "@/lib/cn";

const STORAGE_KEY = "gymrebel-fullscreen";

function readPref(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writePref(on: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, on ? "1" : "0");
  } catch {
    // localStorage kan geblokkeerd zijn (privacymodus) — voorkeur vervalt dan.
  }
}

/**
 * Zwevende knop die de héle app in browser-fullscreen zet. Omdat GymRebel een
 * SPA is blijft fullscreen vanzelf staan bij het navigeren tussen pagina's
 * (geen document-herlaad). De voorkeur wordt onthouden in localStorage; na een
 * *harde* reload of `Esc` valt fullscreen weg — de browser staat programmatisch
 * heractiveren alleen toe na een gebruikersactie, dus herstellen we op de
 * eerstvolgende klik/toets. Op omgevingen zonder Fullscreen-API (o.a. iOS
 * Safari) verbergt de knop zichzelf.
 */
export function FullscreenToggle() {
  const pathname = usePathname();
  const [supported, setSupported] = useState(false);
  const [active, setActive] = useState(false);
  const persistedOnce = useRef(false);

  // Ondersteuning detecteren + de knop-staat synchroon houden met het document
  // (dekt ook `Esc` en de native browser-uitgang).
  useEffect(() => {
    if (typeof document === "undefined" || !document.fullscreenEnabled) return;
    setSupported(true);
    const sync = () => setActive(Boolean(document.fullscreenElement));
    sync();
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  // Voorkeur opslaan zodra de échte staat verandert. De eerste run (mount)
  // slaan we over zodat we een opgeslagen "1" niet meteen overschrijven met "0".
  useEffect(() => {
    if (!supported) return;
    if (!persistedOnce.current) {
      persistedOnce.current = true;
      return;
    }
    writePref(active);
  }, [active, supported]);

  // Auto-herstel na een harde reload: één keer op de eerste gebruikersactie.
  useEffect(() => {
    if (!supported) return;
    if (!readPref() || document.fullscreenElement) return;

    const restore = () => {
      cleanup();
      document.documentElement.requestFullscreen().catch(() => {});
    };
    const cleanup = () => {
      window.removeEventListener("pointerdown", restore);
      window.removeEventListener("keydown", restore);
    };
    window.addEventListener("pointerdown", restore, { once: true });
    window.addEventListener("keydown", restore, { once: true });
    return cleanup;
  }, [supported]);

  const toggle = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }, []);

  if (!supported) return null;

  // In de member-area boven de vaste onderbalk zweven; elders vlak boven de rand.
  const inMember = pathname?.startsWith("/member") ?? false;
  const label = active ? "Volledig scherm sluiten" : "Volledig scherm";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cn(
        "glass fixed left-4 z-[55] flex size-10 items-center justify-center rounded-xl border border-border text-neutral-600 shadow-sm transition-colors hover:text-neutral-900 focus-ring",
        inMember ? "bottom-24" : "bottom-6"
      )}
    >
      {active ? (
        <Minimize className="size-[18px]" />
      ) : (
        <Maximize className="size-[18px]" />
      )}
    </button>
  );
}
