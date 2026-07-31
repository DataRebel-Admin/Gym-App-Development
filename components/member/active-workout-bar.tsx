"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Play } from "@/components/ui/icons";

/** mm:ss (of h:mm:ss vanaf een uur) — zelfde klok als in de actieve sessie. */
function fmtClock(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}

/**
 * Doorlopende balk die op élke member-pagina laat zien dat er een training
 * loopt, met de meelopende klok en een directe ingang om verder te gaan.
 * Zonder dit was een lopende sessie alleen op het dashboard te zien en liep
 * iemand het risico 'm te vergeten (tot de 5-uur-timeout 'm afsloot).
 *
 * Verbergt zichzelf op de actieve-trainingspagina zelf — daar staat de
 * voortgangsbalk met dezelfde klok al bovenaan.
 */
export function ActiveWorkoutBar({ startedAt }: { startedAt: string }) {
  const t = useTranslations("member.active");
  const pathname = usePathname();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = new Date(startedAt).getTime();
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [startedAt]);

  if (pathname?.startsWith("/member/schema/active")) return null;

  return (
    // Dekkende achtergrond (accent-soft-solid = dezelfde tint als accent-soft,
    // maar gemengd met het oppervlak i.p.v. transparant): meescrollende inhoud
    // mag er niet doorheen schemeren. Het sticky-gedrag zit bewust op de wrapper
    // in app/member/layout.tsx, samen met de header — zo houdt de balk bij het
    // scrollen precies dezelfde hoogte.
    <Link
      href="/member/schema/active"
      className="flex items-center gap-2.5 border-b border-accent/30 bg-accent-soft-solid px-4 py-2 text-accent transition-opacity active:opacity-80"
    >
      <span className="relative flex size-2.5 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
        <span className="relative inline-flex size-2.5 rounded-full bg-accent" />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{t("bannerBusy")}</span>
      <span className="shrink-0 font-display text-sm font-bold tabular-nums">
        {fmtClock(elapsed)}
      </span>
      <span className="flex shrink-0 items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-accent-foreground">
        <Play className="size-3 fill-current" /> {t("bannerResume")}
      </span>
    </Link>
  );
}
