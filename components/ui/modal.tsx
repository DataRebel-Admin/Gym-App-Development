"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, m } from "motion/react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Overlay-primitief: gecentreerde modal met fade-backdrop + pop-in.
 * Escape sluit; klik op backdrop sluit. Body-scroll wordt vergrendeld.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const t = useTranslations("common");
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    // Focus terugzetten naar het element dat de modal opende (bij sluiten).
    const opener = document.activeElement as HTMLElement | null;

    // Initiële focus in de modal (eerste focusbare, anders het paneel zelf).
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      // Focus-trap: Tab mag de modal niet uit.
      if (e.key === "Tab" && panel) {
        const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
          (el) => el.offsetParent !== null
        );
        if (items.length === 0) {
          e.preventDefault();
          panel.focus();
          return;
        }
        const firstEl = items[0];
        const lastEl = items[items.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === firstEl || active === panel)) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && active === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };

    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      // Focus terug naar de opener, mits die nog in de DOM staat.
      if (opener && document.contains(opener)) opener.focus();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />
          <m.div
            ref={panelRef}
            role="dialog"
            aria-modal
            aria-label={title}
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 6 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              "relative z-10 flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-surface-2 shadow-lg focus:outline-none",
              className
            )}
          >
            {title ? (
              <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
                <h2 className="font-display text-lg font-bold text-neutral-900">
                  {title}
                </h2>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label={t("close")}
                  className="rounded-lg p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
                >
                  ✕
                </button>
              </div>
            ) : null}
            <div className="overflow-y-auto p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
              {children}
            </div>
          </m.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
