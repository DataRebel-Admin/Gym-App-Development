"use client";

import { useEffect, useState } from "react";
import { useTenant } from "@/components/tenant-provider";
import { GymRebelMark } from "@/components/brand/gymrebel-logo";
import { POST_LOGIN_SPLASH_COOKIE } from "@/lib/constants";

/** Hoe lang de splash minimaal in beeld blijft, zodat het logo ook op een snelle
 *  verbinding echt gezien wordt (het dashboard laadt er onzichtbaar achter). */
const MIN_VISIBLE_MS = 1200;
/** Duur van de uitfade; moet gelijk lopen met de duration-klasse op de overlay. */
const FADE_MS = 450;

/**
 * Gebrande splash direct ná het inloggen: fullscreen accent-verloop met het
 * gym-logo en de gym-naam. De layout leest de `POST_LOGIN_SPLASH_COOKIE`
 * server-side en geeft `show` mee, zodat de overlay al in de SSR-HTML zit en het
 * dashboard er nooit eerst doorheen flitst. De client verwijdert de cookie
 * meteen (eenmalig tonen) en fadet na een kort vast moment uit.
 */
export function PostLoginSplash({ show }: { show: boolean }) {
  const tenant = useTenant();
  const [phase, setPhase] = useState<"visible" | "leaving" | "done">(
    show ? "visible" : "done"
  );
  // Kleine intro: het logo-blok schaalt net op nadat de overlay er staat.
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (!show) return;
    // Eenmalig: cookie direct weg, anders komt de splash bij elke refresh terug.
    document.cookie = `${POST_LOGIN_SPLASH_COOKIE}=; max-age=0; path=/`;
    const settle = requestAnimationFrame(() => setSettled(true));
    const leave = setTimeout(() => setPhase("leaving"), MIN_VISIBLE_MS);
    const done = setTimeout(() => setPhase("done"), MIN_VISIBLE_MS + FADE_MS);
    return () => {
      cancelAnimationFrame(settle);
      clearTimeout(leave);
      clearTimeout(done);
    };
  }, [show]);

  if (phase === "done") return null;

  const name = tenant?.name ?? "GymRebel";

  return (
    <div
      aria-hidden
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center gap-5 bg-accent-gradient text-accent-foreground transition-opacity duration-[450ms] ease-out ${
        phase === "leaving" ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* Zelfde sfeer als het brand-paneel van de login: zachte radialen. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            "radial-gradient(60% 50% at 15% 10%, rgb(255 255 255 / 0.22) 0%, transparent 60%), radial-gradient(50% 50% at 90% 90%, rgb(0 0 0 / 0.18) 0%, transparent 55%)",
        }}
      />
      <div
        className={`relative flex flex-col items-center gap-5 transition-all duration-500 ease-out motion-reduce:transition-none ${
          settled ? "scale-100 opacity-100" : "scale-90 opacity-0"
        }`}
      >
        {tenant?.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={tenant.logoUrl}
            alt=""
            className="h-24 w-24 rounded-3xl bg-white/15 object-contain p-2.5 ring-1 ring-white/25"
          />
        ) : tenant ? (
          <span className="flex size-24 items-center justify-center rounded-3xl bg-white/15 text-4xl font-bold ring-1 ring-white/25">
            {name.charAt(0).toUpperCase()}
          </span>
        ) : (
          <span className="flex size-24 items-center justify-center rounded-3xl bg-white/15 ring-1 ring-white/25">
            <GymRebelMark className="w-14 h-auto" />
          </span>
        )}
        <span className="font-display text-2xl font-bold tracking-tight">
          {name}
        </span>
      </div>
    </div>
  );
}
