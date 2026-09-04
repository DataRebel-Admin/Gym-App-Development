"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { haptic } from "@/lib/haptics";
import {
  Check,
  ChevronRight,
  ClipboardList,
  Dumbbell,
  Play,
  Repeat,
  RotateCcw,
  SkipForward,
  TrendingDown,
} from "@/components/ui/icons";
import {
  DEFAULT_GROUP_REST_SECONDS,
  groupPositionLabel,
  groupSummary,
  type ItemGroup,
} from "@/lib/exercise-groups";
import {
  MAX_GUIDED_ROUNDS,
  completedRoundCount,
  deriveGuidedPosition,
  effectiveGuidedRounds,
  isOpenEnded,
  isRoundComplete,
} from "@/lib/guided-group";
import { getExerciseType } from "@/lib/exercise-types";
import { defaultLogInputValues } from "@/lib/exercise-params";
import { BigStepper } from "./exercise-block";
import { LogField } from "./dynamic-exercise-block";
import type { ActiveExercise, DynRow, SetValue } from "./active-session";

function fmtClock(totalSec: number) {
  const mm = Math.floor(totalSec / 60);
  const ss = totalSec % 60;
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

/**
 * Geleide (ronde-voor-ronde) weergave van één échte groep tijdens de actieve
 * training: A1 → B1 → rust → A2 → B2 → … De positie is volledig AFGELEID uit
 * dezelfde set-/log-state als de lijstweergave (props uit `ActiveSession`),
 * dus wisselen van weergave of een reload verliest nooit data. AMRAP is
 * open-ended met een lokale tijdslimiet-klok; rust binnen een ronde is er
 * nooit, de groep-rust start automatisch ná de laatste oefening van een ronde.
 */
export function GroupGuidedBlock({
  group,
  sets,
  dynRows,
  skipped,
  onChangeStrength,
  onCompleteStrength,
  onRetryStrength,
  onChangeDyn,
  onSaveDyn,
  onRequestRest,
  onShowList,
  onSkip,
  onAlt,
  onUndoSkip,
}: {
  group: ItemGroup<ActiveExercise>;
  sets: Record<string, SetValue[]>;
  dynRows: Record<string, DynRow[]>;
  skipped: Set<string>;
  onChangeStrength: (ex: ActiveExercise, setNumber: number, field: "reps" | "kg", value: string) => void;
  onCompleteStrength: (ex: ActiveExercise, setNumber: number) => void;
  onRetryStrength: (ex: ActiveExercise, setNumber: number) => void;
  onChangeDyn: (ex: ActiveExercise, rowIndex: number, fieldId: string, value: string) => void;
  onSaveDyn: (ex: ActiveExercise, rowIndex: number) => void;
  onRequestRest: (seconds: number) => void;
  onShowList: () => void;
  onSkip: (ex: ActiveExercise) => void;
  onAlt: (ex: ActiveExercise) => void;
  onUndoSkip: (ex: ActiveExercise) => void;
}) {
  const t = useTranslations("member.active");
  const TypeIcon = group.type?.icon ?? Repeat;

  const active = useMemo(
    () => group.items.filter((ex) => !skipped.has(ex.originalExerciseId)),
    [group.items, skipped]
  );
  const skippedMembers = group.items.filter((ex) => skipped.has(ex.originalExerciseId));

  const openEnded = isOpenEnded(group);
  const plannedRounds = effectiveGuidedRounds(group, active.map((i) => Math.max(i.sets, 1)));
  const roundsLimit = openEnded ? MAX_GUIDED_ROUNDS : plannedRounds;
  const groupRest = group.restSeconds ?? DEFAULT_GROUP_REST_SECONDS;

  // "Doorschuiven": stappen die het lid zonder loggen passeert. Bewust lokaal en
  // vluchtig — na een reload komt de stap gewoon terug (er is niets opgeslagen).
  const [passed, setPassed] = useState<Set<string>>(() => new Set());
  const passKey = (ex: ActiveExercise, round: number) => `${ex.originalExerciseId}:${round}`;

  function stepDone(ex: ActiveExercise, round: number): boolean {
    if (passed.has(passKey(ex, round))) return true;
    if (ex.exerciseType === "strength") return Boolean(sets[ex.exerciseId]?.[round - 1]?.done);
    return Boolean(dynRows[ex.exerciseId]?.[round - 1]?.saved);
  }
  const isDone = (memberIndex: number, round: number) => {
    const ex = active[memberIndex];
    return ex ? stepDone(ex, round) : true;
  };

  // AMRAP: het lid rondt de groep zelf af (de rondeteller is open-ended).
  const [amrapFinished, setAmrapFinished] = useState(false);

  const pos = deriveGuidedPosition({ memberCount: active.length, rounds: roundsLimit, isDone });
  const finished =
    active.length > 0 && ((openEnded && amrapFinished) || pos.kind === "done");
  const step = !finished && pos.kind === "step" ? pos : null;
  const stepEx = step ? active[step.memberIndex] ?? null : null;
  const doneRounds = completedRoundCount(roundsLimit, active.length, isDone);

  // AMRAP-tijdslimiet: lokale hulpklok (overleeft bewust geen reload). De
  // resterende tijd leeft in state en tikt via het interval — geen Date.now()
  // tijdens de render.
  const capSeconds = group.timeCapSeconds ?? 0;
  const [capStartedAt, setCapStartedAt] = useState<number | null>(null);
  const [capLeft, setCapLeft] = useState(capSeconds);
  useEffect(() => {
    if (capStartedAt == null) return;
    const id = window.setInterval(() => {
      setCapLeft(Math.max(0, capSeconds - Math.floor((Date.now() - capStartedAt) / 1000)));
    }, 500);
    return () => window.clearInterval(id);
  }, [capStartedAt, capSeconds]);
  const timeUp = openEnded && capSeconds > 0 && capStartedAt != null && capLeft <= 0;
  const timeUpBuzzed = useRef(false);
  useEffect(() => {
    if (timeUp && !timeUpBuzzed.current) {
      timeUpBuzzed.current = true;
      void haptic("medium", [120, 60, 120]);
    }
  }, [timeUp]);

  // Eerder mislukte opslagen elders in de groep (de wizard is al doorgelopen) —
  // zichtbaar houden zodat een netwerkfout nooit stil data kost.
  const failedSteps: { ex: ActiveExercise; round: number }[] = [];
  for (const ex of active) {
    if (ex.exerciseType === "strength") {
      (sets[ex.exerciseId] ?? []).forEach((s, i) => {
        if (s.failed && !(step && stepEx === ex && step.round === i + 1)) {
          failedSteps.push({ ex, round: i + 1 });
        }
      });
    }
  }

  const isStr = stepEx ? stepEx.exerciseType === "strength" : false;
  const curSet: SetValue =
    stepEx && step
      ? sets[stepEx.exerciseId]?.[step.round - 1] ?? { reps: "", kg: "", done: false, saving: false }
      : { reps: "", kg: "", done: false, saving: false };
  const prevSet =
    stepEx && step ? stepEx.previous?.sets.find((s) => s.setNumber === step.round) : undefined;
  const curRow: DynRow =
    stepEx && step
      ? dynRows[stepEx.exerciseId]?.[step.round - 1] ?? {
          values: defaultLogInputValues(stepEx.exerciseType),
          saved: false,
        }
      : { values: {}, saved: false };
  const logFields = stepEx && !isStr ? getExerciseType(stepEx.exerciseType).logFields : [];

  const lastOfRound =
    step != null && active.every((_, i) => i === step.memberIndex || isDone(i, step.round));
  const nextEx = step
    ? active.find((_, i) => i !== step.memberIndex && !isDone(i, step.round)) ?? null
    : null;

  function completeCurrent() {
    if (!step || !stepEx) return;
    if (isStr) onCompleteStrength(stepEx, step.round);
    else onSaveDyn(stepEx, step.round - 1);
    if (lastOfRound && !openEnded && step.round < roundsLimit) {
      onRequestRest(groupRest);
    } else if (!lastOfRound) {
      void haptic("light", 10);
    }
  }

  function passCurrent() {
    if (!step || !stepEx) return;
    setPassed((prev) => new Set(prev).add(passKey(stepEx, step.round)));
  }

  const actionLabel = !step
    ? ""
    : !lastOfRound
      ? t("guided.nextExercise")
      : !openEnded && step.round >= roundsLimit
        ? t("guided.finishGroup")
        : t("guided.finishRound");

  const nextHint = !step
    ? null
    : !lastOfRound && nextEx
      ? t("guided.next", { name: nextEx.name })
      : lastOfRound && !openEnded && step.round < roundsLimit
        ? t("guided.thenRest", { seconds: groupRest, round: step.round + 1 })
        : null;

  return (
    <div className="overflow-hidden rounded-2xl border border-violet-200 bg-surface-1">
      {/* Groep-kop */}
      <div className="flex items-center gap-2 bg-violet-50 px-3 py-2.5 text-xs font-semibold text-violet-700">
        <TypeIcon className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{groupSummary(group)}</span>
        <button
          type="button"
          onClick={onShowList}
          className="flex shrink-0 items-center gap-1 rounded-lg bg-white/80 px-2 py-1 text-[11px] font-bold text-violet-700 active:scale-95"
        >
          <ClipboardList className="size-3" /> {t("guided.viewList")}
        </button>
      </div>

      <div className="flex flex-col gap-3 p-3">
        {active.length === 0 ? (
          <p className="py-2 text-center text-sm text-neutral-500">{t("guided.allSkipped")}</p>
        ) : finished ? (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-accent-soft text-accent">
              <Check className="size-6" />
            </span>
            <p className="text-sm font-semibold text-neutral-800">{t("guided.allDone")}</p>
            {openEnded ? (
              <p className="text-xs text-neutral-500">{t("guided.roundsDone", { count: doneRounds })}</p>
            ) : null}
            {openEnded && amrapFinished ? (
              <button
                type="button"
                onClick={() => setAmrapFinished(false)}
                className="mt-1 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-neutral-600 active:scale-95"
              >
                {t("guided.amrapResume")}
              </button>
            ) : null}
          </div>
        ) : step && stepEx ? (
          <>
            {/* Ronde-voortgang */}
            <div className="flex items-center justify-between gap-2">
              <p className="font-display text-sm font-bold text-neutral-900">
                {openEnded
                  ? t("guided.roundLabel", { round: step.round })
                  : t("guided.roundOf", { round: step.round, total: roundsLimit })}
              </p>
              {openEnded ? (
                <span className="text-xs font-semibold text-neutral-500">
                  {t("guided.roundsDone", { count: doneRounds })}
                </span>
              ) : (
                <div className="flex items-center gap-1">
                  {Array.from({ length: roundsLimit }, (_, r) => (
                    <span
                      key={r}
                      className={cn(
                        "h-1.5 w-4 rounded-full",
                        isRoundComplete(r + 1, active.length, isDone)
                          ? "bg-accent"
                          : r + 1 === step.round
                            ? "bg-violet-300"
                            : "bg-surface-2"
                      )}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Stappen binnen de ronde (A/B/C) */}
            <div className="flex items-center gap-1.5">
              {active.map((mEx, i) => {
                const d = stepDone(mEx, step.round);
                const current = i === step.memberIndex;
                return (
                  <span
                    key={mEx.originalExerciseId}
                    className={cn(
                      "flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[11px] font-bold",
                      d
                        ? "bg-accent text-accent-foreground"
                        : current
                          ? "bg-violet-600 text-white"
                          : "bg-surface-2 text-neutral-400"
                    )}
                  >
                    {d ? <Check className="size-3.5" /> : groupPositionLabel(group.items.indexOf(mEx))}
                  </span>
                );
              })}
            </div>

            {/* AMRAP-tijdslimiet */}
            {openEnded && capSeconds > 0 ? (
              <div
                className={cn(
                  "flex items-center justify-between gap-2 rounded-xl px-3 py-2",
                  timeUp ? "bg-orange-100 text-orange-800" : "bg-orange-50 text-orange-700"
                )}
              >
                {capStartedAt == null ? (
                  <>
                    <span className="font-display text-lg font-bold tabular-nums">
                      {fmtClock(capSeconds)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCapStartedAt(Date.now())}
                      className="flex items-center gap-1 rounded-lg bg-orange-600 px-2.5 py-1.5 text-xs font-bold text-white active:scale-95"
                    >
                      <Play className="size-3.5" /> {t("guided.amrapStart")}
                    </button>
                  </>
                ) : (
                  <>
                    <span className="font-display text-lg font-bold tabular-nums">
                      {fmtClock(capLeft)}
                    </span>
                    <span className="text-xs font-semibold">
                      {timeUp ? t("guided.amrapTimeUp") : t("guided.amrapLeft")}
                    </span>
                  </>
                )}
              </div>
            ) : null}

            {/* Huidige oefening */}
            <div className="rounded-2xl border border-border bg-surface-0 p-3">
              <Link
                href={`/member/history/exercise/${stepEx.exerciseId}`}
                className="flex items-start gap-3 transition-opacity active:opacity-70"
                aria-label={t("viewExplanationOf", { name: stepEx.name })}
              >
                {stepEx.thumbUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={stepEx.thumbUrl}
                    alt=""
                    aria-hidden
                    className="h-14 w-14 shrink-0 rounded-2xl object-cover shadow-sm"
                  />
                ) : (
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent">
                    <Dumbbell className="size-6" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="flex size-5 items-center justify-center rounded-full bg-violet-100 text-[10px] font-bold text-violet-700">
                      {groupPositionLabel(group.items.indexOf(stepEx))}
                    </span>
                    {stepEx.machineName ? (
                      <span className="truncate text-[11px] text-neutral-400">{stepEx.machineName}</span>
                    ) : null}
                  </div>
                  <h3 className="mt-0.5 font-display text-lg font-bold leading-tight text-neutral-900">
                    {stepEx.name}
                  </h3>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    {isStr ? (
                      <>
                        {t("guided.targetReps", { reps: stepEx.targetReps })}
                        {stepEx.targetWeightKg
                          ? t("targetWeight", { weight: stepEx.targetWeightKg })
                          : ""}
                        {stepEx.tempo ? t("targetTempo", { tempo: stepEx.tempo }) : ""}
                      </>
                    ) : stepEx.targetSummary && stepEx.targetSummary !== "—" ? (
                      stepEx.targetSummary
                    ) : null}
                  </p>
                </div>
                <ChevronRight className="mt-1 size-4 shrink-0 text-neutral-300" />
              </Link>

              {stepEx.memberNote ? (
                <p className="mt-2 rounded-lg bg-accent-soft px-3 py-1.5 text-xs font-medium text-accent">
                  ✎ {stepEx.memberNote}
                </p>
              ) : null}
              {(stepEx.dropsetCount ?? 0) >= 1 ? (
                <p className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-rose-500">
                  <TrendingDown className="size-3.5" />{" "}
                  {t("dropsetHint", { count: stepEx.dropsetCount ?? 0 })}
                </p>
              ) : null}
              {stepEx.substitutedFrom ? (
                <p className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-neutral-400">
                  <Repeat className="size-3 text-accent" />
                  {t("substitutedFrom", { name: stepEx.substitutedFrom })}
                </p>
              ) : null}

              {/* Invoer voor déze set/ronde */}
              {isStr ? (
                <div className="mt-3 flex flex-col gap-2">
                  <BigStepper
                    value={curSet.kg}
                    unit={t("kg")}
                    step={2.5}
                    placeholder={
                      prevSet && prevSet.weightKg > 0
                        ? String(prevSet.weightKg)
                        : stepEx.targetWeightKg
                          ? String(stepEx.targetWeightKg)
                          : undefined
                    }
                    onChange={(v) => onChangeStrength(stepEx, step.round, "kg", v)}
                  />
                  <BigStepper
                    value={curSet.reps}
                    unit={t("reps")}
                    step={1}
                    placeholder={
                      prevSet
                        ? String(prevSet.reps)
                        : stepEx.targetReps
                          ? String(stepEx.targetReps)
                          : undefined
                    }
                    onChange={(v) => onChangeStrength(stepEx, step.round, "reps", v)}
                  />
                  {curSet.failed ? (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-red-600">{t("notSaved")}</span>
                      <button
                        type="button"
                        onClick={() => onRetryStrength(stepEx, step.round)}
                        className="rounded-lg bg-red-600 px-3 py-1 text-xs font-semibold text-white active:scale-95"
                      >
                        {t("retrySave")}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="mt-3 flex flex-col gap-2">
                  <div className="flex flex-wrap items-end gap-2.5">
                    {logFields.map((field) => (
                      <LogField
                        key={field.id}
                        field={field}
                        value={curRow.values[field.id] ?? ""}
                        placeholder={stepEx.targetValues[field.id]}
                        onChange={(v) => onChangeDyn(stepEx, step.round - 1, field.id, v)}
                      />
                    ))}
                  </div>
                  {curRow.failed ? (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-red-600">{t("notSaved")}</span>
                      <button
                        type="button"
                        onClick={() => onSaveDyn(stepEx, step.round - 1)}
                        className="rounded-lg bg-red-600 px-3 py-1 text-xs font-semibold text-white active:scale-95"
                      >
                        {t("retrySave")}
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            {/* Grote actieknop */}
            <button
              type="button"
              onClick={completeCurrent}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent-gradient px-6 py-3.5 text-base font-bold text-accent-foreground shadow-accent active:scale-[0.98]"
            >
              {curSet.saving ? (
                <span className="size-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <Check className="size-5" />
              )}
              {actionLabel}
            </button>

            {nextHint ? (
              <p className="text-center text-xs font-medium text-neutral-500">{nextHint}</p>
            ) : null}

            {/* Secundaire acties */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onAlt(stepEx)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border py-2 text-xs font-semibold text-neutral-600 active:scale-[0.98]"
              >
                <Repeat className="size-3.5 text-accent" /> {t("chooseAlternative")}
              </button>
              <button
                type="button"
                onClick={() => onSkip(stepEx)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border py-2 text-xs font-semibold text-neutral-600 active:scale-[0.98]"
              >
                <SkipForward className="size-3.5" /> {t("skip")}
              </button>
            </div>
            <div className="flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={passCurrent}
                className="text-xs font-medium text-neutral-400 active:text-neutral-700"
              >
                {t("guided.passSet")}
              </button>
              {openEnded ? (
                <button
                  type="button"
                  onClick={() => setAmrapFinished(true)}
                  className="text-xs font-semibold text-orange-600 active:opacity-70"
                >
                  {t("guided.amrapFinish")}
                </button>
              ) : null}
            </div>
          </>
        ) : null}

        {/* Eerder mislukte opslagen elders in de groep */}
        {failedSteps.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            {failedSteps.map(({ ex, round }) => (
              <div
                key={`${ex.originalExerciseId}-${round}`}
                className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2"
              >
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-red-700">
                  {ex.name} · {t("setLabel", { number: round })} · {t("notSaved")}
                </span>
                <button
                  type="button"
                  onClick={() => onRetryStrength(ex, round)}
                  className="shrink-0 rounded-lg bg-red-600 px-2.5 py-1 text-xs font-semibold text-white active:scale-95"
                >
                  {t("retrySave")}
                </button>
              </div>
            ))}
          </div>
        ) : null}

        {/* Overgeslagen oefeningen in deze groep */}
        {skippedMembers.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            {skippedMembers.map((ex) => (
              <div
                key={ex.originalExerciseId}
                className="flex items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2"
              >
                <SkipForward className="size-3.5 shrink-0 text-neutral-400" />
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-neutral-500 line-through">
                  {ex.name}
                </span>
                <button
                  type="button"
                  onClick={() => onUndoSkip(ex)}
                  className="flex shrink-0 items-center gap-1 text-xs font-semibold text-accent active:scale-95"
                >
                  <RotateCcw className="size-3" /> {t("undo")}
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
