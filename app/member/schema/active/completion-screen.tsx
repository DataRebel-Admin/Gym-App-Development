"use client";

import { useState, useTransition } from "react";
import { m, useReducedMotion } from "motion/react";
import { useFormStatus } from "react-dom";
import { useLocale, useTranslations } from "next-intl";
import type { RewardProps, SessionActions } from "./active-session";
import { Modal } from "@/components/ui/modal";
import { Trophy, Flame, Check, Dumbbell, Clock, Target, Sparkles, HeartPulse } from "@/components/ui/icons";
import { type AppLocale, isLocale } from "@/lib/i18n/config";
import { formatNumber } from "@/lib/i18n/format";
import { moodOptions } from "@/lib/workout-moods";

type ActiveT = ReturnType<typeof useTranslations<"member.active">>;

function fmtDuration(totalSec: number, t: ActiveT) {
  const mm = Math.floor(totalSec / 60);
  const ss = totalSec % 60;
  return mm > 0 ? t("durationMs", { minutes: mm, seconds: ss }) : t("durationS", { seconds: ss });
}

function FinishButton() {
  const t = useTranslations("member.active");
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-2xl bg-accent-gradient px-6 py-4 text-center text-lg font-bold text-accent-foreground shadow-accent transition-transform active:scale-[0.98] disabled:opacity-60"
    >
      {pending ? t("saving") : t("saveWorkout")}
    </button>
  );
}

const CONFETTI_COLORS = ["var(--tenant-accent)", "#fbbf24", "#34d399", "#60a5fa"];
// Deterministische spreiding (pure render — geen random, geen effect).
const CONFETTI = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  x: ((i / 17) - 0.5) * 320,
  rot: (i * 47) % 360,
  delay: (i % 6) * 0.04,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
}));

/** Korte confetti-burst (CSS/motion, respecteert reduced-motion). */
function Confetti() {
  const reduced = useReducedMotion();
  const pieces = CONFETTI;
  if (reduced) return null;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 flex justify-center">
      {pieces.map((p) => (
        <m.span
          key={p.id}
          className="absolute top-10 h-2 w-2 rounded-[1px]"
          style={{ backgroundColor: p.color }}
          initial={{ y: 0, x: 0, opacity: 1, rotate: 0 }}
          animate={{ y: 360, x: p.x, opacity: 0, rotate: p.rot }}
          transition={{ duration: 1.4, delay: p.delay, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}

/**
 * Premium afrond-scherm: samenvatting (duur, volume, sets, reps, rust), nieuwe
 * PR's, bijgewerkte streak en weekdoel, plus een succes-animatie. Afronden sluit
 * de sessie via de bestaande `endSession`-action (enige mutatie).
 */
export function CompletionScreen({
  sessionId,
  endSession,
  saveWorkoutMood,
  cancelSession,
  completedExercises,
  totalExercises,
  completedSets,
  totalReps,
  totalVolume,
  durationSec,
  estRestSec,
  newRecords,
  streakWeeks,
  weeklyGoal,
  weeklyGoalReached,
  workoutsThisWeek,
  reward,
  onContinue,
}: {
  sessionId: string;
  endSession: SessionActions["endSession"];
  saveWorkoutMood: SessionActions["saveWorkoutMood"];
  cancelSession: SessionActions["cancelSession"];
  completedExercises: number;
  totalExercises: number;
  completedSets: number;
  totalReps: number;
  totalVolume: number;
  durationSec: number;
  estRestSec: number;
  newRecords: { name: string; weightKg: number; reps: number }[];
  streakWeeks: number;
  weeklyGoal: number;
  weeklyGoalReached: boolean;
  workoutsThisWeek: number;
  reward: RewardProps;
  onContinue: () => void;
}) {
  const t = useTranslations("member.active");
  const locale = useLocale();
  const loc: AppLocale = isLocale(locale) ? locale : "nl";
  const goalRemaining = Math.max(0, weeklyGoal - workoutsThisWeek);

  // Workout Mood — one-tap, optimistisch. Kiezen mag altijd (ook wijzigen).
  const [mood, setMood] = useState<string | null>(reward.initialMood);
  const [, startMood] = useTransition();
  function chooseMood(key: string) {
    const next = mood === key ? null : key;
    setMood(next);
    if (next) startMood(() => void saveWorkoutMood({ sessionId, mood: next }));
  }

  // Workout annuleren — bewust minder prominent + verplichte bevestiging.
  const [confirmCancel, setConfirmCancel] = useState(false);

  return (
    <m.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] overflow-y-auto bg-surface-0/95 px-6 py-10 backdrop-blur"
      role="dialog"
      aria-modal="true"
      aria-label={t("completedAria")}
    >
      <m.div
        initial={{ y: 24, opacity: 0, scale: 0.96 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="relative mx-auto w-full max-w-sm text-center"
      >
        <Confetti />
        <div className="relative mx-auto mb-5 flex h-28 w-28 items-center justify-center">
          <m.span
            className="absolute inset-0 rounded-full bg-accent-soft"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: [0.6, 1.15, 1], opacity: 1 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          />
          <m.span
            className="relative flex h-20 w-20 items-center justify-center rounded-full bg-accent-gradient text-accent-foreground shadow-accent"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.15, type: "spring", stiffness: 260, damping: 18 }}
          >
            <Check className="size-10" strokeWidth={3} />
          </m.span>
        </div>

        <h1 className="font-display text-2xl font-bold text-neutral-900">
          {t("completedTitle")}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          {t("completedSubtitle", { completed: completedExercises, total: totalExercises })}
        </p>

        {/* Workout Mood — one-tap trainingsbeleving */}
        <div className="mt-6 rounded-2xl border border-border bg-surface-1 p-4">
          <p className="text-sm font-semibold text-neutral-800">{t("moodQuestion")}</p>
          <div className="mt-3 flex items-stretch justify-between gap-1.5">
            {moodOptions().map((mo) => {
              const active = mood === mo.key;
              return (
                <button
                  key={mo.key}
                  type="button"
                  onClick={() => chooseMood(mo.key)}
                  aria-pressed={active}
                  aria-label={mo.label}
                  title={mo.label}
                  className={`flex flex-1 flex-col items-center gap-1 rounded-xl border px-1 py-2 transition-all active:scale-95 ${
                    active
                      ? "border-accent bg-accent-soft"
                      : "border-transparent hover:bg-surface-2"
                  }`}
                >
                  <span className="text-2xl leading-none">{mo.emoji}</span>
                  <span
                    className={`text-[10px] font-medium leading-tight ${
                      active ? "text-accent" : "text-neutral-400"
                    }`}
                  >
                    {mo.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Statistieken */}
        <div className="mt-6 grid grid-cols-2 gap-3 text-left">
          <Stat icon={<Clock className="size-4" />} value={fmtDuration(durationSec, t)} label={t("statDuration")} />
          <Stat icon={<Dumbbell className="size-4" />} value={`${formatNumber(Math.round(totalVolume), loc)} kg`} label={t("statVolume")} />
          <Stat icon={<Check className="size-4" />} value={String(completedSets)} label={t("statSets")} />
          <Stat icon={<Target className="size-4" />} value={String(totalReps)} label={t("statReps")} />
        </div>
        <p className="mt-2 text-xs text-neutral-400">
          {t("plannedRest", { duration: fmtDuration(estRestSec, t) })}
        </p>

        {/* Nieuwe PR's */}
        {newRecords.length > 0 ? (
          <m.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-5 rounded-2xl border border-accent/40 bg-accent-soft p-4 text-left"
          >
            <p className="flex items-center gap-2 font-display text-sm font-bold text-accent">
              <Trophy className="size-4" />
              {t("newRecords", { count: newRecords.length })}
            </p>
            <ul className="mt-2 flex flex-col gap-1">
              {newRecords.slice(0, 4).map((r, i) => (
                <li key={i} className="flex items-center justify-between text-sm">
                  <span className="truncate text-neutral-800">{r.name}</span>
                  <span className="shrink-0 font-semibold tabular-nums text-neutral-900">
                    {r.weightKg} kg × {r.reps}
                  </span>
                </li>
              ))}
            </ul>
          </m.div>
        ) : null}

        {/* Streak + weekdoel */}
        <div className="mt-3 grid grid-cols-2 gap-3 text-left">
          <div className="flex items-center gap-2.5 rounded-2xl border border-border bg-surface-1 p-3.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <Flame className="size-5" />
            </span>
            <div>
              <p className="font-display text-lg font-bold leading-none text-neutral-900">
                {t("streakWeeks", { count: streakWeeks })}
              </p>
              <p className="text-xs text-neutral-500">{t("streakLabel")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 rounded-2xl border border-border bg-surface-1 p-3.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <Target className="size-5" />
            </span>
            <div>
              <p className="font-display text-lg font-bold leading-none text-neutral-900">
                {workoutsThisWeek}/{weeklyGoal}
              </p>
              <p className="text-xs text-neutral-500">{t("weekGoalLabel")}</p>
            </div>
          </div>
        </div>

        <p className="mt-3 text-sm font-medium text-neutral-600">
          {weeklyGoalReached
            ? t("goalReached")
            : t("goalRemaining", { count: goalRemaining })}
        </p>

        {/* Motiverende quote */}
        {reward.quote ? (
          <m.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="mt-5 rounded-2xl bg-accent-gradient p-4 text-left text-accent-foreground shadow-accent"
          >
            <Sparkles className="size-5 opacity-90" />
            <p className="mt-2 font-display text-base font-semibold leading-snug">
              &ldquo;{reward.quote}&rdquo;
            </p>
          </m.div>
        ) : null}

        {/* Herstelherinnering */}
        <m.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.42, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="mt-3 flex items-start gap-3 rounded-2xl border border-border bg-surface-1 p-4 text-left"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <HeartPulse className="size-5" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-accent">
              {t("recoveryTitle")}
            </p>
            <p className="mt-0.5 text-sm text-neutral-700">{reward.recoveryTip}</p>
          </div>
        </m.div>

        <form action={endSession} className="mt-6">
          <input type="hidden" name="sessionId" value={sessionId} />
          <FinishButton />
        </form>
        <button
          type="button"
          onClick={onContinue}
          className="mt-3 w-full rounded-2xl border border-border px-6 py-3 text-center text-sm font-medium text-neutral-700 active:bg-surface-2"
        >
          {t("continueTraining")}
        </button>

        {/* Annuleren — subtiel, minder prominent dan afronden, met bevestiging. */}
        <button
          type="button"
          onClick={() => setConfirmCancel(true)}
          className="mt-4 w-full text-center text-xs font-medium text-neutral-400 underline-offset-2 hover:text-red-600 hover:underline"
        >
          {t("cancelWorkout")}
        </button>
      </m.div>

      <Modal open={confirmCancel} onClose={() => setConfirmCancel(false)} title={t("cancelConfirmTitle")}>
        <p className="text-sm text-neutral-600">{t("cancelConfirmBody")}</p>
        <div className="mt-5 flex flex-col gap-2">
          <form action={cancelSession}>
            <input type="hidden" name="sessionId" value={sessionId} />
            <button
              type="submit"
              className="w-full rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white active:opacity-90"
            >
              {t("cancelConfirm")}
            </button>
          </form>
          <button
            type="button"
            onClick={() => setConfirmCancel(false)}
            className="w-full rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-neutral-700 active:bg-surface-2"
          >
            {t("keepWorkout")}
          </button>
        </div>
      </Modal>
    </m.div>
  );
}

function Stat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface-1 px-4 py-3.5">
      <span className="flex size-7 items-center justify-center rounded-lg bg-accent-soft text-accent">
        {icon}
      </span>
      <p className="mt-2 font-display text-xl font-bold leading-none text-neutral-900">
        {value}
      </p>
      <p className="mt-1 text-xs text-neutral-500">{label}</p>
    </div>
  );
}
