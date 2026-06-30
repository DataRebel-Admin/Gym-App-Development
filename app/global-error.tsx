"use client";

import { useEffect } from "react";
import "./globals.css";

/**
 * Catastrofale fout — vervángt de root-layout (en dus alle providers). Daarom
 * bewust standalone: eigen <html>/<body>, geen motion/tenant-context. Behoudt de
 * premium uitstraling via de design-tokens (default GymRebel-branding, donker
 * thema) en de globale CSS. Animaties zijn pure CSS zodat er geen provider nodig is.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="nl" data-theme="dark" className="h-full antialiased">
      <body className="min-h-full">
        <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-16 text-center">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-32 left-1/2 size-[40rem] -translate-x-1/2 rounded-full opacity-20 blur-3xl"
            style={{ background: "var(--accent-gradient)" }}
          />
          <div className="ge-fade relative flex w-full max-w-md flex-col items-center">
            <span className="mb-8 flex size-9 items-center justify-center rounded-lg bg-accent-gradient text-sm font-bold text-accent-foreground shadow-accent">
              G
            </span>

            <svg
              viewBox="0 0 200 200"
              aria-hidden
              className="ge-float size-28 text-accent"
              fill="none"
              stroke="currentColor"
              strokeWidth={6}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M100 36 L168 158 H32 Z" />
              <line x1="100" y1="84" x2="100" y2="116" strokeWidth={8} />
              <circle cx="100" cy="138" r="3.5" fill="currentColor" stroke="none" />
            </svg>

            <span
              aria-hidden
              className="mt-6 text-7xl font-bold leading-none text-accent-gradient"
            >
              500
            </span>
            <h1 className="mt-6 text-3xl font-bold tracking-tight text-neutral-900">
              Er ging iets mis
            </h1>
            <p className="mt-3 max-w-sm text-base leading-relaxed text-neutral-500">
              Er is een onverwachte fout opgetreden. Probeer het opnieuw — blijft
              het misgaan, dan kijken wij ernaar.
            </p>

            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={reset}
                className="ge-btn inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-accent-gradient px-6 text-base font-semibold text-accent-foreground shadow-accent"
              >
                Probeer opnieuw
              </button>
              <a
                href="/"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface-1 px-6 text-base font-semibold text-neutral-900"
              >
                Naar home
              </a>
            </div>
          </div>
        </main>

        <style>{`
          @keyframes ge-fade-in { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
          @keyframes ge-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
          .ge-fade { animation: ge-fade-in .4s cubic-bezier(0.16,1,0.3,1) both; }
          .ge-float { animation: ge-float 5s ease-in-out infinite; }
          .ge-btn { transition: transform .2s cubic-bezier(0.16,1,0.3,1); }
          .ge-btn:hover { transform: translateY(-2px); }
          @media (prefers-reduced-motion: reduce) {
            .ge-fade, .ge-float, .ge-btn { animation: none !important; transition: none !important; }
          }
        `}</style>
      </body>
    </html>
  );
}
