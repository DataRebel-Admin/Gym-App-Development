import type { Metadata } from "next";

export const metadata: Metadata = { title: "Offline" };

/**
 * Statische offline-fallback. De service worker precachet deze pagina en toont
 * 'm wanneer een navigatie faalt zonder verbinding. Bewust **zonder** tenant-
 * of auth-data zodat 'ie altijd (ook volledig offline) rendert.
 */
export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
        <svg viewBox="0 0 512 512" width="34" height="34" fill="currentColor" aria-hidden="true">
          <rect x="150" y="240" width="212" height="32" rx="16" />
          <rect x="160" y="214" width="24" height="84" rx="10" />
          <rect x="328" y="214" width="24" height="84" rx="10" />
          <rect x="116" y="190" width="34" height="132" rx="16" />
          <rect x="362" y="190" width="34" height="132" rx="16" />
        </svg>
      </div>
      <div className="space-y-1.5">
        <h1 className="text-xl font-semibold text-neutral-900">Je bent offline</h1>
        <p className="mx-auto max-w-sm text-sm text-neutral-500">
          Er is momenteel geen internetverbinding. Zodra je weer online bent, kun je
          verdergaan met trainen.
        </p>
      </div>
      <a
        href="/"
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
      >
        Opnieuw proberen
      </a>
    </main>
  );
}
