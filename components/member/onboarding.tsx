"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { useTranslations } from "next-intl";
import { useTenant } from "@/components/tenant-provider";
import { Dumbbell, QrCode, Trophy, Flame, Check } from "@/components/ui/icons";

const STORAGE_KEY = "gymrebel-member-onboarding";

/** Window-event waarmee de rondleiding handmatig heropend kan worden (bv. vanuit
 *  de member-drawer). Losgekoppeld zodat elke UI-plek de tour kan triggeren
 *  zonder de localStorage-vlag te hoeven kennen. */
export const OPEN_ONBOARDING_EVENT = "gymrebel:open-onboarding";

/** Herstart de onboarding-rondleiding: wist de vlag en opent de overlay direct. */
export function reopenOnboarding() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* genegeerd */
  }
  window.dispatchEvent(new Event(OPEN_ONBOARDING_EVENT));
}

type Step = {
  icon: React.ReactNode;
  title: string;
  text: string;
};

/**
 * Premium onboarding-overlay voor nieuwe leden. Eénmalig getoond (vlag in
 * localStorage — geen DB-wijziging). Korte, motiverende stappen met voortgangsbalk
 * en subtiele motion. Sluit netjes af; bij "overslaan" idem.
 */
export function MemberOnboarding() {
  const t = useTranslations("member.onboarding");
  const tCommon = useTranslations("common");
  const tenant = useTenant();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      if (!window.localStorage.getItem(STORAGE_KEY)) setOpen(true);
    } catch {
      /* localStorage niet beschikbaar — toon niets */
    }
    // Handmatig heropenen (member-drawer → "Rondleiding opnieuw bekijken").
    const onReopen = () => {
      setStep(0);
      setOpen(true);
    };
    window.addEventListener(OPEN_ONBOARDING_EVENT, onReopen);
    return () => window.removeEventListener(OPEN_ONBOARDING_EVENT, onReopen);
  }, []);

  function finish() {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* genegeerd */
    }
    setOpen(false);
  }

  const steps: Step[] = [
    {
      icon: <Dumbbell className="size-9" />,
      title: tenant?.name ? t("welcomeWithGym", { gym: tenant.name }) : t("welcome"),
      text: t("welcomeText"),
    },
    {
      icon: <QrCode className="size-9" />,
      title: t("scanTitle"),
      text: t("scanText"),
    },
    {
      icon: <Trophy className="size-9" />,
      title: t("progressTitle"),
      text: t("progressText"),
    },
    {
      icon: <Flame className="size-9" />,
      title: t("readyTitle"),
      text: t("readyText"),
    },
  ];

  const last = step === steps.length - 1;
  const current = steps[step];

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
            {/* Voortgangsbalk */}
            <div className="mb-6 flex gap-1.5">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2"
                >
                  <m.div
                    className="h-full rounded-full bg-accent-gradient"
                    initial={false}
                    animate={{ width: i <= step ? "100%" : "0%" }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              ))}
            </div>

            <AnimatePresence mode="wait">
              <m.div
                key={step}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col items-center text-center"
              >
                <m.span
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1, type: "spring", stiffness: 240, damping: 18 }}
                  className="mb-5 flex size-20 items-center justify-center rounded-3xl bg-accent-gradient text-accent-foreground shadow-accent"
                >
                  {current.icon}
                </m.span>
                <h2 className="font-display text-2xl font-bold text-neutral-900">
                  {current.title}
                </h2>
                <p className="mt-2 max-w-xs text-sm text-neutral-500">{current.text}</p>
              </m.div>
            </AnimatePresence>

            <div className="mt-7 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => (last ? finish() : setStep((s) => s + 1))}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent-gradient px-6 py-4 text-base font-bold text-accent-foreground shadow-accent transition-transform active:scale-[0.98]"
              >
                {last ? (
                  <>
                    <Check className="size-5" /> {t("start")}
                  </>
                ) : (
                  tCommon("next")
                )}
              </button>
              {!last ? (
                <button
                  type="button"
                  onClick={finish}
                  className="w-full py-1 text-center text-sm font-medium text-neutral-500 active:text-neutral-900"
                >
                  {t("skip")}
                </button>
              ) : null}
            </div>
          </m.div>
        </m.div>
      ) : null}
    </AnimatePresence>
  );
}
