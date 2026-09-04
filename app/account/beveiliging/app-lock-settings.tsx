"use client";

import { useEffect, useState } from "react";
import { Fingerprint } from "@/components/ui/icons";
import {
  appLockAvailable,
  appLockEnabled,
  isNativeApp,
  markUnlockedThisLaunch,
  setAppLockEnabled,
  verifyAppLock,
} from "@/lib/app-lock";

/**
 * Aan/uit-schakelaar voor de native app-vergrendeling. Rendert alléén in de
 * Capacitor-app op een toestel dat kan vergrendelen; op web bestaat de sectie
 * niet (daar is de passkey de biometrische route). De voorkeur is per toestel
 * (lib/app-lock.ts), dus geen server-action nodig. Hardcoded NL, zoals de
 * rest van deze pagina.
 */
export function AppLockSettings() {
  const [visible, setVisible] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isNativeApp()) return;
    let cancelled = false;
    void appLockAvailable().then((ok) => {
      if (cancelled || !ok) return;
      setVisible(true);
      setEnabled(appLockEnabled());
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!visible) return null;

  async function toggle() {
    setError(null);
    if (enabled) {
      setAppLockEnabled(false);
      setEnabled(false);
      return;
    }
    // Eerst één keer verifiëren, zodat het slot nooit aangaat op een toestel
    // waar de prompt vervolgens niet blijkt te werken.
    setBusy(true);
    const ok = await verifyAppLock("Ontgrendelen");
    setBusy(false);
    if (!ok) {
      setError("Verificatie niet gelukt. Het slot is niet aangezet.");
      return;
    }
    setAppLockEnabled(true);
    markUnlockedThisLaunch();
    setEnabled(true);
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-1 p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
            <Fingerprint className="size-4" /> App-vergrendeling
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            Vraag bij het openen van de app je vingerafdruk, gezicht of
            schermvergrendeling. Geldt alleen voor dit toestel.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={toggle}
          disabled={busy}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
            enabled ? "bg-accent" : "bg-neutral-300"
          }`}
        >
          <span
            className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition-transform ${
              enabled ? "translate-x-[22px]" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </section>
  );
}
