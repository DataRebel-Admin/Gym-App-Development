"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Fingerprint } from "@/components/ui/icons";
import {
  appLockEnabled,
  isNativeApp,
  isUnlockedThisLaunch,
  markUnlockedThisLaunch,
  verifyAppLock,
} from "@/lib/app-lock";

/**
 * Vergrendelscherm van de native app. Gemount in de ingelogde layouts
 * (member/owner/account — bewust niet in de root, anders zit ook /login op
 * slot). Bij een koude start met het slot aan: dekkende overlay + direct de
 * systeemprompt (vingerafdruk/gezicht, pincode-terugval). Ontgrendeld blijft
 * ontgrendeld tot de app echt opnieuw start (zie lib/app-lock.ts).
 * Buiten de app (browser/PWA) rendert dit niets.
 */
export function AppLockGate() {
  const t = useTranslations("appLock");
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isNativeApp() || isUnlockedThisLaunch() || !appLockEnabled()) return;
    setLocked(true);
    void attempt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function attempt() {
    setBusy(true);
    const ok = await verifyAppLock(document.title || "GymRebel");
    setBusy(false);
    if (ok) {
      markUnlockedThisLaunch();
      setLocked(false);
    }
  }

  if (!locked) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-surface-1 px-8 text-center"
      role="dialog"
      aria-modal="true"
      aria-label={t("lockedTitle")}
    >
      <span className="flex size-20 items-center justify-center rounded-3xl bg-accent-gradient text-accent-foreground shadow-accent">
        <Fingerprint className="size-9" />
      </span>
      <div>
        <h1 className="font-display text-2xl font-bold text-neutral-900">{t("lockedTitle")}</h1>
        <p className="mt-2 text-sm text-neutral-500">{t("lockedText")}</p>
      </div>
      <button
        type="button"
        onClick={attempt}
        disabled={busy}
        className="flex w-full max-w-xs items-center justify-center gap-2 rounded-2xl bg-accent-gradient px-6 py-4 text-base font-bold text-accent-foreground shadow-accent transition-transform active:scale-[0.98] disabled:opacity-60"
      >
        <Fingerprint className="size-5" />
        {busy ? t("busy") : t("retry")}
      </button>
      <a
        href="/api/auth/signout"
        className="text-sm font-medium text-neutral-500 active:text-neutral-900"
      >
        {t("useLogin")}
      </a>
    </div>
  );
}
