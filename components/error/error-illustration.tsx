"use client";

import { m } from "motion/react";
import type { ErrorCode } from "@/lib/errors";

/**
 * Subtiele, op de huisstijl afgestemde lijn-illustratie per foutcode. Eén
 * cohesieve set (gym-thema): de lijnen volgen `currentColor` (= de tenant-accent
 * via `text-accent`), de zachte schijf erachter gebruikt het accent-gradient.
 * Animatie is bewust ingetogen (zacht zweven + ademende gloed); reduced-motion
 * wordt globaal geneutraliseerd door de MotionProvider.
 */
export function ErrorIllustration({
  code,
  className,
}: {
  code: ErrorCode;
  className?: string;
}) {
  return (
    <m.div
      className={className}
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="relative mx-auto grid size-44 place-items-center sm:size-52">
        {/* Ademende accent-gloed */}
        <m.span
          aria-hidden
          className="absolute inset-0 rounded-full bg-accent-gradient opacity-20 blur-2xl"
          animate={{ opacity: [0.16, 0.28, 0.16], scale: [0.95, 1.05, 0.95] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* Zachte schijf */}
        <span
          aria-hidden
          className="absolute inset-3 rounded-full border border-border bg-surface-1/60"
        />
        {/* Zwevende illustratie */}
        <m.svg
          viewBox="0 0 200 200"
          role="img"
          aria-hidden
          className="relative size-32 text-accent sm:size-36"
          fill="none"
          stroke="currentColor"
          strokeWidth={6}
          strokeLinecap="round"
          strokeLinejoin="round"
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        >
          <Glyph code={code} />
        </m.svg>
      </div>
    </m.div>
  );
}

function Glyph({ code }: { code: ErrorCode }) {
  switch (code) {
    case 404:
      // Vergrootglas met een halter erin (zoeken naar een verplaatste pagina).
      return (
        <>
          <circle cx="86" cy="86" r="52" className="opacity-90" />
          <line x1="124" y1="124" x2="162" y2="162" strokeWidth={10} />
          {/* mini-halter in de lens */}
          <line x1="66" y1="86" x2="106" y2="86" strokeWidth={7} />
          <line x1="62" y1="74" x2="62" y2="98" />
          <line x1="110" y1="74" x2="110" y2="98" />
          <line x1="52" y1="80" x2="52" y2="92" />
          <line x1="120" y1="80" x2="120" y2="92" />
        </>
      );
    case 403:
      // Schild met slot (geen toegang).
      return (
        <>
          <path d="M100 26 L156 50 V100 C156 134 132 160 100 174 C68 160 44 134 44 100 V50 Z" />
          <rect x="80" y="92" width="40" height="34" rx="6" className="opacity-90" />
          <path d="M88 92 V80 a12 12 0 0 1 24 0 V92" strokeWidth={5} />
        </>
      );
    case 401:
      // Open slot met sleutelgat (even inloggen).
      return (
        <>
          <rect x="52" y="92" width="96" height="74" rx="12" />
          <path d="M72 92 V70 a28 28 0 0 1 50 -16" strokeWidth={6} />
          <circle cx="100" cy="122" r="9" className="opacity-90" />
          <line x1="100" y1="131" x2="100" y2="148" />
        </>
      );
    case 503:
      // Klok met moersleutel (tijdelijk onderhoud).
      return (
        <>
          <circle cx="100" cy="104" r="58" />
          <line x1="100" y1="104" x2="100" y2="70" strokeWidth={7} />
          <line x1="100" y1="104" x2="128" y2="118" strokeWidth={7} />
          <line x1="100" y1="30" x2="100" y2="44" strokeWidth={5} />
        </>
      );
    case 500:
    default:
      // Waarschuwingsdriehoek met halter (er ging iets mis).
      return (
        <>
          <path d="M100 36 L168 158 H32 Z" />
          <line x1="100" y1="84" x2="100" y2="116" strokeWidth={8} />
          <circle cx="100" cy="138" r="3.5" fill="currentColor" stroke="none" />
        </>
      );
  }
}
