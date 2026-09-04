"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { useTranslations } from "next-intl";
import { startRegistration, browserSupportsWebAuthn } from "@simplewebauthn/browser";
import {
  startPasskeyRegistration,
  finishPasskeyRegistration,
} from "@/app/account/passkey-actions";
import { Fingerprint, Check } from "@/components/ui/icons";
import { useClientValue } from "@/lib/hooks/use-client-value";
import { markPasskeyDevice } from "@/lib/passkey-device";
import { logWebAuthnError } from "@/lib/webauthn-error";
import {
  ONBOARDING_DONE_EVENT,
  ONBOARDING_STORAGE_KEY,
} from "@/components/member/onboarding";

/** Per gebruiker (meerdere accounts op één toestel krijgen elk hun eigen vraag). */
const DISMISS_PREFIX = "gymrebel-passkey-prompt-";

function dismissed(userId: string): boolean {
  try {
    return Boolean(window.localStorage.getItem(DISMISS_PREFIX + userId));
  } catch {
    return true;
  }
}

/**
 * Vraagt direct na het inloggen éénmalig of het lid met vingerafdruk/Face ID
 * wil inloggen (passkey), zolang het account er nog geen heeft. Instellen
 * hergebruikt de bestaande registratie-actions van /account/beveiliging.
 *
 * Toont zichzelf alleen als het kán (WebAuthn beschikbaar; in de huidige
 * Android-app-build is dat niet zo en blijft de prompt dus vanzelf weg) en
 * nooit bovenop de onboarding-rondleiding: is die nog niet gezien, dan wacht
 * de prompt op {@link ONBOARDING_DONE_EVENT}. "Niet nu" onthoudt de keuze per
 * toestel (localStorage, patroon van de onboarding-vlag) — instellen kan
 * daarna altijd nog via Account → Beveiliging.
 */
export function PasskeyPrompt({
  userId,
  hasPasskey,
}: {
  userId: string;
  hasPasskey: boolean;
}) {
  const t = useTranslations("member.passkeyPrompt");
  const supported = useClientValue(browserSupportsWebAuthn, false);
  // Startstand: alleen open als niet weggeklikt én de tour al gezien is
  // (server: dicht; geen localStorage → dicht, fail-closed).
  const initiallyEligible = useClientValue(() => {
    try {
      if (dismissed(userId)) return false;
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
    // Rondleiding net afgerond of overgeslagen → nu is het onze beurt.
    const onTourDone = () => {
      if (!dismissed(userId)) setOverride(true);
    };
    window.addEventListener(ONBOARDING_DONE_EVENT, onTourDone);
    return () => window.removeEventListener(ONBOARDING_DONE_EVENT, onTourDone);
  }, [userId]);

  const open = !hasPasskey && supported && (override ?? initiallyEligible);

  function remember() {
    try {
      window.localStorage.setItem(DISMISS_PREFIX + userId, "1");
    } catch {
      /* genegeerd */
    }
  }

  function dismiss() {
    remember();
    setOverride(false);
  }

  async function enable() {
    setError(null);
    setBusy(true);
    try {
      const options = await startPasskeyRegistration();
      const response = await startRegistration(options);
      const suggested =
        typeof navigator !== "undefined" && navigator.platform
          ? navigator.platform
          : undefined;
      const res = await finishPasskeyRegistration({ response, name: suggested });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      remember();
      // Volgende bezoek aan de inlogpagina start de biometrische login direct.
      markPasskeyDevice();
      setDone(true);
    } catch (err) {
      // Detail naar console + ringbuffer (komt mee met "Probleem melden");
      // de gebruiker ziet alleen de nette melding.
      logWebAuthnError("passkey-prompt", err);
      setError(t("cancelled"));
    } finally {
      setBusy(false);
    }
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
          aria-label={t("dialogLabel")}
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
                {done ? t("successTitle") : t("title")}
              </h2>
              <p className="mt-2 max-w-xs text-sm text-neutral-500">
                {done ? t("successText") : t("text")}
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
                  <Check className="size-5" /> {t("doneButton")}
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
                    {busy ? t("busy") : t("enable")}
                  </button>
                  <button
                    type="button"
                    onClick={dismiss}
                    disabled={busy}
                    className="w-full py-1 text-center text-sm font-medium text-neutral-500 active:text-neutral-900"
                  >
                    {t("notNow")}
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
