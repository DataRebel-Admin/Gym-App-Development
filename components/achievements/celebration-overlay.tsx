"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { m, AnimatePresence, useReducedMotion } from "motion/react";
import { cn } from "@/lib/cn";
import { Trophy, ChevronRight, X } from "@/components/ui/icons";
import { rarityMeta } from "@/lib/achievements/rarity";
import type { PendingCelebration } from "@/lib/achievements/evaluate";
import { dismissCelebrations } from "@/app/member/trophies/actions";

const CONFETTI_COLORS = ["var(--tenant-accent)", "#fbbf24", "#34d399", "#60a5fa", "#f472b6"];
const CONFETTI = Array.from({ length: 26 }, (_, i) => ({
  id: i,
  x: ((i / 25) - 0.5) * 380,
  rot: (i * 53) % 360,
  delay: (i % 8) * 0.05,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
}));

function Confetti() {
  const reduced = useReducedMotion();
  if (reduced) return null;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 flex justify-center overflow-hidden">
      {CONFETTI.map((p) => (
        <m.span
          key={p.id}
          className="absolute top-0 h-2.5 w-2.5 rounded-[2px]"
          style={{ backgroundColor: p.color }}
          initial={{ y: -20, x: 0, opacity: 1, rotate: 0 }}
          animate={{ y: 520, x: p.x, opacity: 0, rotate: p.rot }}
          transition={{ duration: 1.8, delay: p.delay, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}

/**
 * Celebration-overlay die één of meer zojuist behaalde trofeeën viert: badge +
 * confetti + subtiele animatie + trilling op mobiel. Toont ze één voor één; bij
 * sluiten worden ze server-side als "gevierd" gemarkeerd (geen herhaling).
 */
export function CelebrationOverlay({ celebrations }: { celebrations: PendingCelebration[] }) {
  const t = useTranslations("achievements.ui");
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(celebrations.length > 0);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate([25, 40, 60]);
      } catch {
        /* niet ondersteund */
      }
    }
  }, [index, open]);

  if (celebrations.length === 0 || !open) return null;

  const current = celebrations[index];
  const meta = rarityMeta(current.rarity);
  const hasNext = index < celebrations.length - 1;

  function close() {
    setOpen(false);
    startTransition(() => {
      void dismissCelebrations(celebrations.map((c) => c.id));
    });
  }

  function next() {
    if (hasNext) setIndex((i) => i + 1);
    else close();
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-neutral-950/70 backdrop-blur-sm" onClick={close} />
      <AnimatePresence mode="wait">
        <m.div
          key={current.id}
          initial={{ scale: reduced ? 1 : 0.85, opacity: 0, y: reduced ? 0 : 16 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/10 bg-surface-1 p-7 text-center shadow-2xl"
        >
          <Confetti />
          <button
            type="button"
            onClick={close}
            className="absolute right-3 top-3 z-10 flex size-8 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-100"
            aria-label={t("celebration.close")}
          >
            <X className="size-4" />
          </button>

          <p className="relative text-xs font-bold uppercase tracking-[0.2em] text-accent">
            {t("celebration.title")}
          </p>

          <m.div
            className="relative mx-auto mt-5 flex size-28 items-center justify-center"
            initial={reduced ? undefined : { rotate: -8, scale: 0.7 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.1 }}
          >
            <span className={cn("absolute inset-0 rounded-full blur-2xl", meta.glow)} aria-hidden />
            <span className={cn("relative flex size-28 items-center justify-center rounded-full ring-4 ring-white/30 shadow-xl", meta.gradient)}>
              <Trophy className={cn("size-14", meta.onGradient)} strokeWidth={1.8} />
            </span>
          </m.div>

          <h2 className="relative mt-5 font-display text-2xl font-bold text-neutral-900">
            {current.title}
          </h2>
          <span className={cn("relative mt-2 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold", meta.chip)}>
            {current.rarityLabel}
          </span>
          <p className="relative mt-3 text-sm text-neutral-500">{current.description}</p>

          <div className="relative mt-6 flex flex-col gap-2">
            <button
              type="button"
              onClick={next}
              className="w-full rounded-2xl bg-accent-gradient px-6 py-3.5 text-center text-base font-bold text-accent-foreground shadow-accent transition-transform active:scale-[0.98]"
            >
              {hasNext
                ? t("celebration.next", { current: index + 1, total: celebrations.length })
                : t("celebration.celebrate")}
            </button>
            <Link
              href="/member/trophies"
              onClick={close}
              className="inline-flex items-center justify-center gap-1 text-sm font-semibold text-accent"
            >
              {t("celebration.viewAll")} <ChevronRight className="size-4" />
            </Link>
          </div>
        </m.div>
      </AnimatePresence>
    </div>
  );
}
