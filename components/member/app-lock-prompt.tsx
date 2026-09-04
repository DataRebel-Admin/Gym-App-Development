"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { useTranslations } from "next-intl";
import { Fingerprint, Check } from "@/components/ui/icons";
import { useClientValue } from "@/lib/hooks/use-client-value";
import {
  appLockAvailable,
  appLockEnabled,
  appLockPromptDismissed,
  dismissAppLockPrompt,
  isNativeApp,
  markUnlockedThisLaunch,
  setAppLockEnabled,
  verifyAppLock,
} from "@/lib/app-lock";
import {
  ONBOARDING_DONE_EVENT,
  ONBOARDING_STORAGE_KEY,
} from "@/components/member/onboarding";

/**
 * Vraagt in de native app éénmalig of het lid de app wil vergrendelen met de
 * vingerafdruk (native app-slot) — de app-tegenhanger van de passkey-prompt,
 * die in de app juist wordt onderdrukt (één duidelijke flow per omgeving).
 * Zelfde spelregels: nooit bovenop de onboarding-rondleiding, "Niet nu" wordt
 * per toestel per gebruiker onthouden, en instellen kan altijd nog via
 * Account → Beveiliging.
 */
export function AppLockPrompt({ userId }: { userId: string }) {
  const t = useTranslations("appLock");
  // Beschikbaar = native app + toestel kan vergrendelen + nog niet aan.
  const [eligible, setEligible] = useState(false);
  const tourSeen = useClientValue(() => {
    try {
      return Boolean(window.localStorage.getItem(ONBOARDING_STORAGE_KEY));
    } catch {
      return false;
    }
  }, false);
  const [override, setOverride] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isNativeApp() || appLockEnabled() || appLockPromptDismissed(userId)) return;
    let cancelled = false;
    void appLockAvailable().then((ok) => {
      if (!cancelled && ok) setEligible(true);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    const onTourDone = () => {
      if (!appLockPromptDismissed(userId)) setOverride(true);
    };
    window.addEventListener(ONBOARDING_DONE_EVENT, onTourDone);
    return () => window.removeEventListener(ONBOARDING_DONE_EVENT, onTourDone);
  }, [userId]);

  const open = eligible && (override ?? tourSeen);

  function dismiss() {
    dismissAppLockPrompt(userId);
    setOverride(false);
  }

  async function enable() {
    setError(null);
    setBusy(true);
    const ok = await verifyAppLock(t("verifyTitle"));
    setBusy(false);
    if (!ok) {
      setError(t("promptFailed"));
      return;
    }
    setAppLockEnabled(true);
    // Zojuist geverifieerd → deze sessie niet meteen weer op slot.
    markUnlockedThisLaunch();
    dismissAppLockPrompt(userId);
    setDone(true);
  }

  return (
    <AnimatePresence>
      {open ? (
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label={t("promptDialogLabel")}
        >
          <m.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-md rounded-t-3xl border border-border bg-surface-1 p-6 pb-8 shadow-2xl sm:rounded-3xl"
          >
            <div className="flex flex-col items-center text-center">
              <m.span
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, type: "spring", stiffness: 240, damping: 18 }}
                className="mb-5 flex size-20 items-center justify-center rounded-3xl bg-accent-gradient text-accent-foreground shadow-accent"
              >
                {done ? <Check className="size-9" /> : <Fingerprint className="size-9" />}
              </m.span>
              <h2 className="font-display text-2xl font-bold text-neutral-900">
                {done ? t("promptSuccessTitle") : t("promptTitle")}
              </h2>
              <p className="mt-2 max-w-xs text-sm text-neutral-500">
                {done ? t("promptSuccessText") : t("promptText")}
              </p>
              {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
            </div>

            <div className="mt-7 flex flex-col gap-2">
              {done ? (
                <button
                  type="button"
                  onClick={() => setOverride(false)}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent-gradient px-6 py-4 text-base font-bold text-accent-foreground shadow-accent transition-transform active:scale-[0.98]"
                >
                  <Check className="size-5" /> {t("promptDone")}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={enable}
                    disabled={busy}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent-gradient px-6 py-4 text-base font-bold text-accent-foreground shadow-accent transition-transform active:scale-[0.98] disabled:opacity-60"
                  >
                    <Fingerprint className="size-5" />
                    {busy ? t("busy") : t("promptEnable")}
                  </button>
                  <button
                    type="button"
                    onClick={dismiss}
                    disabled={busy}
                    className="w-full py-1 text-center text-sm font-medium text-neutral-500 active:text-neutral-900"
                  >
                    {t("promptNotNow")}
                  </button>
                </>
              )}
            </div>
          </m.div>
        </m.div>
      ) : null}
    </AnimatePresence>
  );
}
