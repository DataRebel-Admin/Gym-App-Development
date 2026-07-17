"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence, m } from "motion/react";
import type { AlternativeSuggestion } from "@/lib/exercise-alternatives";
import { haptic } from "@/lib/haptics";
import { ExerciseBlock } from "./exercise-block";
import { DynamicExerciseBlock } from "./dynamic-exercise-block";
import { CompletionScreen } from "./completion-screen";
import { useRestTimer, FloatingTimer } from "./rest-timer";
import { Fullscreenable, FullscreenButton } from "@/components/ui/fullscreen";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { Check, SkipForward, Repeat, RotateCcw, Timer, Dumbbell, X } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

/**
 * Server-actions die de actieve sessie muteren, geïnjecteerd door de pagina die
 * `ActiveSession` rendert. De lid-pagina injecteert de zelf-gescoopte lid-actions
 * (`app/member/schema/actions.ts`); de trainer-pagina de op het lid gebonden
 * trainer-varianten. Zo blijft er één UI voor beide flows.
 */
export type SessionActions = {
  saveSet: (input: {
    sessionId: string;
    exerciseId: string;
    setNumber: number;
    reps: number;
    weightKg: number;
  }) => Promise<{ ok: boolean }>;
  saveLog: (input: {
    sessionId: string;
    exerciseId: string;
    setNumber: number;
    values: Record<string, string>;
  }) => Promise<{ ok: boolean }>;
  saveExerciseNote: (input: {
    sessionId: string;
    exerciseId: string;
    notes: string;
  }) => Promise<{ ok: boolean }>;
  skipExercise: (input: { sessionId: string; exerciseId: string }) => Promise<{ ok: boolean }>;
  unskipExercise: (input: { sessionId: string; exerciseId: string }) => Promise<{ ok: boolean }>;
  getExerciseAlternatives: (input: {
    exerciseId: string;
    excludeIds: string[];
  }) => Promise<{ ok: boolean; alternatives: AlternativeSuggestion[] }>;
  substituteExercise: (input: {
    sessionId: string;
    fromExerciseId: string;
    toExerciseId: string;
  }) => Promise<{
    ok: boolean;
    replacement?: { exerciseId: string; name: string; machineName: string | null; thumbUrl: string | null };
  }>;
  saveWorkoutMood: (input: { sessionId: string; mood: string }) => Promise<{ ok: boolean }>;
  cancelSession: (formData: FormData) => void | Promise<void>;
  endSession: (formData: FormData) => void | Promise<void>;
};

/** Lokale (optimistische) staat van één set. `failed` = opslaan mislukte (netwerk
 *  of server) → toon een retry-affordance i.p.v. stil dataverlies. */
export type SetValue = {
  reps: string;
  kg: string;
  done: boolean;
  saving: boolean;
  failed?: boolean;
};

type SetEntry = { setNumber: number; reps: number; weightKg: number; params?: unknown };
export type PreviousPerformance = {
  date: string;
  sets: { setNumber: number; reps: number; weightKg: number }[];
};
export type ActiveExercise = {
  /** Gerenderde oefening-id (na een evt. vervanging) — hierop loggen/linken we. */
  exerciseId: string;
  /** Id van het oorspronkelijke template-item (stabiel bij overslaan/vervangen). */
  originalExerciseId: string;
  /** Oefeningstype — kracht volgt het set/reps/kg-pad; overige types een eigen log-UI. */
  exerciseType: string;
  name: string;
  machineName: string | null;
  thumbUrl: string | null;
  /** Naam van de oorspronkelijke oefening als deze sessie een alternatief gebruikt. */
  substitutedFrom: string | null;
  /** Of deze oefening in de huidige sessie is overgeslagen. */
  skipped: boolean;
  dayName: string | null;
  sets: number;
  targetReps: number;
  targetWeightKg: number | null;
  tempo: string | null;
  /** Type-bewuste doel-samenvatting (voor niet-kracht-types). */
  targetSummary: string;
  restSeconds: number;
  note: string | null;
  entries: SetEntry[];
  previous: PreviousPerformance | null;
};

/** Of de oefening het klassieke kracht-trackingpad volgt. */
function isStrength(ex: ActiveExercise): boolean {
  return ex.exerciseType === "strength";
}

export type WorkoutContextProps = {
  historicalBest: Record<string, number>;
  projectedStreakWeeks: number;
  weeklyGoal: number;
  weeklyGoalReached: boolean;
  workoutsThisWeekIncl: number;
};

/** Afrondscherm-beloning: mood-registratie + motiverende quote + hersteltip. */
export type RewardProps = {
  initialMood: string | null;
  recoveryTip: string;
  quote: string | null;
};

const DEFAULT_REST = 90;

/** localStorage-sleutel voor de per-sessie timer-override (overleeft reload). */
function sessionTimerKey(sessionId: string) {
  return `gymrebel-session-timers-${sessionId}`;
}

function fmtClock(totalSec: number) {
  const mm = Math.floor(totalSec / 60);
  const ss = totalSec % 60;
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

function emptySet(): SetValue {
  return { reps: "", kg: "", done: false, saving: false };
}

function emptySets(len: number): SetValue[] {
  return Array.from({ length: Math.max(len, 1) }, emptySet);
}

/**
 * Orkestreert de actieve training als één doorlopende lijst: alle oefeningen
 * onder elkaar (continuous scroll), per oefening de sets met grote steppers,
 * een "vorige keer"-regel en de mogelijkheid extra sets toe te voegen. Sticky
 * voortgangsbalk, meelopende rusttimer en afrond-scherm blijven behouden.
 *
 * Flexibiliteit tijdens de training (nieuw): rust-/set-timers per sessie aan/uit,
 * een oefening overslaan en een alternatief kiezen als het apparaat bezet is.
 * Alle timeracties lopen via één timer (`timer.dismiss()`) zodat er niets blijft
 * doorlopen na skippen/vervangen/afronden.
 */
export function ActiveSession({
  sessionId,
  startedAt,
  exercises,
  context,
  reward,
  timersDefaultOn,
  actions,
}: {
  sessionId: string;
  startedAt: string;
  exercises: ActiveExercise[];
  context: WorkoutContextProps;
  reward: RewardProps;
  timersDefaultOn: boolean;
  actions: SessionActions;
}) {
  const t = useTranslations("member.active");
  const toast = useToast();
  const timer = useRestTimer();
  const [, startTransition] = useTransition();

  // Lokale (mutable) oefeningenlijst: een gekozen alternatief vervangt de identiteit
  // in-place zonder herladen; het set/rep-schema van het origineel blijft.
  const [exList, setExList] = useState<ActiveExercise[]>(exercises);

  // Overgeslagen oefeningen (op originele template-id). Init uit de serverstaat.
  const [skipped, setSkipped] = useState<Set<string>>(
    () => new Set(exercises.filter((e) => e.skipped).map((e) => e.originalExerciseId))
  );

  // Rust-/set-timers voor déze sessie. Init uit de globale voorkeur; een per-sessie
  // override in localStorage wint (gehydrateerd na mount, zoals de rest-timer-settings).
  const [timersEnabled, setTimersEnabledState] = useState(timersDefaultOn);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(sessionTimerKey(sessionId));
      if (raw === "on") setTimersEnabledState(true);
      else if (raw === "off") setTimersEnabledState(false);
    } catch {
      /* genegeerd */
    }
  }, [sessionId]);

  function setTimers(enabled: boolean) {
    setTimersEnabledState(enabled);
    try {
      window.localStorage.setItem(sessionTimerKey(sessionId), enabled ? "on" : "off");
    } catch {
      /* genegeerd */
    }
    // Timers uitzetten stopt meteen een eventueel lopende timer (geen meldingen).
    if (!enabled) timer.dismiss();
  }

  // Set-state alleen voor kracht-oefeningen (klassiek reps×kg-pad). Niet-kracht-
  // types beheren hun eigen state in DynamicExerciseBlock en rapporteren "klaar"
  // via dynamicDone.
  const [setState, setSetState] = useState<Record<string, SetValue[]>>(() => {
    const init: Record<string, SetValue[]> = {};
    for (const ex of exercises) {
      if (!isStrength(ex)) continue;
      const maxEntry = ex.entries.reduce((mx, e) => Math.max(mx, e.setNumber), 0);
      const len = Math.max(ex.sets, maxEntry, 1);
      init[ex.exerciseId] = Array.from({ length: len }, (_, i) => {
        const entry = ex.entries.find((e) => e.setNumber === i + 1);
        return {
          reps: entry ? String(entry.reps) : "",
          kg: entry ? String(entry.weightKg) : "",
          done: Boolean(entry),
          saving: false,
        };
      });
    }
    return init;
  });

  // "Klaar"-status van niet-kracht-oefeningen (gerapporteerd door de dynamische
  // blokken). Init: klaar als er al een logregel bestaat.
  const [dynamicDone, setDynamicDone] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const ex of exercises) {
      if (isStrength(ex)) continue;
      init[ex.exerciseId] = ex.entries.length > 0;
    }
    return init;
  });

  const [notes, setNotes] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const ex of exercises) init[ex.exerciseId] = ex.note ?? "";
    return init;
  });

  const [showCompletion, setShowCompletion] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Bevestigings-/keuze-modals.
  const [skipFor, setSkipFor] = useState<ActiveExercise | null>(null);
  const [altFor, setAltFor] = useState<ActiveExercise | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  function patchSet(exerciseId: string, idx: number, patch: Partial<SetValue>) {
    setSetState((prev) => {
      const arr = prev[exerciseId]?.slice();
      if (!arr) return prev;
      arr[idx] = { ...arr[idx], ...patch };
      return { ...prev, [exerciseId]: arr };
    });
  }

  function changeSet(exerciseId: string, setNumber: number, field: "reps" | "kg", value: string) {
    patchSet(exerciseId, setNumber - 1, { [field]: value });
  }

  function addSet(exerciseId: string) {
    setSetState((prev) => {
      if (prev[exerciseId].length >= 20) return prev;
      return { ...prev, [exerciseId]: [...prev[exerciseId], emptySet()] };
    });
  }

  function removeSet(exerciseId: string, setNumber: number) {
    setSetState((prev) => {
      const arr = prev[exerciseId];
      const idx = setNumber - 1;
      if (idx !== arr.length - 1 || arr[idx]?.done) return prev;
      return { ...prev, [exerciseId]: arr.slice(0, -1) };
    });
  }

  /**
   * Sla één kracht-set op met harde foutafhandeling. Cruciaal: de promise wordt
   * hier ge-`catch`t. Zonder dat escaleert een netwerkfout in een async-transitie
   * (React 19) naar de error-boundary → de hele sessie-UI unmount en alle nog niet
   * opgeslagen sets in state zijn weg. Nu blijft de UI leven; alleen de betrokken
   * set krijgt een `failed`-vlag + een retry-affordance, en het lid ziet een toast.
   */
  function saveSetValue(ex: ActiveExercise, setNumber: number, reps: number, kg: number) {
    const idx = setNumber - 1;
    patchSet(ex.exerciseId, idx, { saving: true, failed: false });
    startTransition(async () => {
      try {
        const res = await actions.saveSet({
          sessionId,
          exerciseId: ex.exerciseId,
          setNumber,
          reps,
          weightKg: kg,
        });
        if (res?.ok) {
          patchSet(ex.exerciseId, idx, { saving: false, failed: false });
        } else {
          patchSet(ex.exerciseId, idx, { saving: false, failed: true });
          toast.error(t("saveFailed"));
        }
      } catch {
        patchSet(ex.exerciseId, idx, { saving: false, failed: true });
        toast.error(t("saveFailed"));
      }
    });
  }

  function toggleSet(ex: ActiveExercise, setNumber: number) {
    const idx = setNumber - 1;
    const cur = setState[ex.exerciseId][idx];
    const nextDone = !cur.done;

    if (!nextDone) {
      patchSet(ex.exerciseId, idx, { done: false, failed: false });
      return;
    }

    const prevSet = ex.previous?.sets.find((s) => s.setNumber === setNumber);
    const reps = Number(cur.reps || prevSet?.reps || ex.targetReps || 0);
    const fallbackKg =
      prevSet && prevSet.weightKg > 0
        ? prevSet.weightKg
        : ex.targetWeightKg != null
          ? ex.targetWeightKg
          : 0;
    const kg = Number(cur.kg || fallbackKg || 0);
    patchSet(ex.exerciseId, idx, {
      done: true,
      reps: String(reps),
      kg: cur.kg || (fallbackKg ? String(fallbackKg) : ""),
    });
    saveSetValue(ex, setNumber, reps, kg);

    // Timers uit voor deze sessie → geen auto-rusttimer, geen trilling/geluid.
    if (!timersEnabled) return;
    if (timer.vibrateOn) void haptic("light", 15);
    timer.startRest(ex.restSeconds > 0 ? ex.restSeconds : DEFAULT_REST);
  }

  /** Opnieuw opslaan na een mislukte set — leest de huidige (evt. bijgestelde) waarden. */
  function retrySet(ex: ActiveExercise, setNumber: number) {
    const cur = setState[ex.exerciseId]?.[setNumber - 1];
    if (!cur) return;
    const reps = Number(cur.reps || 0);
    const kg = Number(cur.kg || 0);
    saveSetValue(ex, setNumber, reps, kg);
  }

  function noteBlur(exerciseId: string) {
    const value = notes[exerciseId] ?? "";
    startTransition(async () => {
      try {
        const res = await actions.saveExerciseNote({ sessionId, exerciseId, notes: value });
        if (!res?.ok) toast.error(t("noteFailed"));
      } catch {
        toast.error(t("noteFailed"));
      }
    });
  }

  // --- Overslaan --------------------------------------------------------------
  function confirmSkip() {
    const ex = skipFor;
    if (!ex) return;
    setSkipFor(null);
    // Lopende timer netjes stoppen; oefening markeren; door naar de volgende.
    timer.dismiss();
    setSkipped((prev) => new Set(prev).add(ex.originalExerciseId));
    startTransition(async () => {
      try {
        const res = await actions.skipExercise({ sessionId, exerciseId: ex.originalExerciseId });
        if (!res?.ok) throw new Error("skip failed");
      } catch {
        // Rollback: de skip is niet doorgekomen → oefening weer actief tonen.
        setSkipped((prev) => {
          const next = new Set(prev);
          next.delete(ex.originalExerciseId);
          return next;
        });
        toast.error(t("actionFailed"));
      }
    });
  }

  function undoSkip(ex: ActiveExercise) {
    setSkipped((prev) => {
      const next = new Set(prev);
      next.delete(ex.originalExerciseId);
      return next;
    });
    startTransition(async () => {
      try {
        const res = await actions.unskipExercise({ sessionId, exerciseId: ex.originalExerciseId });
        if (!res?.ok) throw new Error("unskip failed");
      } catch {
        // Rollback: undo kwam niet door → oefening blijft overgeslagen.
        setSkipped((prev) => new Set(prev).add(ex.originalExerciseId));
        toast.error(t("actionFailed"));
      }
    });
  }

  // --- Alternatief kiezen -----------------------------------------------------
  function applySubstitution(ex: ActiveExercise, alt: AlternativeSuggestion) {
    const oldId = ex.exerciseId;
    const newId = alt.exerciseId;

    // Identiteit vervangen, schema (sets/reps/rust/type) behouden, log fris.
    setExList((prev) =>
      prev.map((e) =>
        e.originalExerciseId === ex.originalExerciseId
          ? {
              ...e,
              exerciseId: newId,
              name: alt.name,
              machineName: alt.machineName,
              thumbUrl: alt.thumbUrl,
              substitutedFrom: e.substitutedFrom ?? e.name,
              skipped: false,
              entries: [],
              previous: null,
            }
          : e
      )
    );

    // Keyed state omzetten van oude → nieuwe id.
    if (isStrength(ex)) {
      setSetState((prev) => {
        const next = { ...prev };
        delete next[oldId];
        next[newId] = emptySets(ex.sets);
        return next;
      });
    } else {
      setDynamicDone((prev) => {
        const next = { ...prev };
        delete next[oldId];
        next[newId] = false;
        return next;
      });
    }
    setNotes((prev) => {
      const next = { ...prev };
      delete next[oldId];
      next[newId] = "";
      return next;
    });

    // Actieve timer stopt bij het vervangen (geen doorlopende rust van het origineel).
    timer.dismiss();
  }

  // Voortgang + live samenvatting — overgeslagen oefeningen tellen niet mee.
  const activeExercises = useMemo(
    () => exList.filter((ex) => !skipped.has(ex.originalExerciseId)),
    [exList, skipped]
  );

  const stats = useMemo(() => {
    let completedSets = 0;
    let totalSets = 0;
    let completedExercises = 0;
    let totalVolume = 0;
    let totalReps = 0;
    let estRestSec = 0;
    let estRemainingSec = 0;
    const newRecords: { name: string; weightKg: number; reps: number }[] = [];

    for (const ex of activeExercises) {
      if (!isStrength(ex)) {
        totalSets += 1;
        if (dynamicDone[ex.exerciseId]) {
          completedSets += 1;
          completedExercises += 1;
          estRestSec += ex.restSeconds || 0;
        } else {
          estRemainingSec += (ex.restSeconds || DEFAULT_REST) + 30;
        }
        continue;
      }

      const sets = setState[ex.exerciseId];
      if (!sets) continue;
      totalSets += sets.length;
      const doneSets = sets.filter((s) => s.done);
      completedSets += doneSets.length;
      if (sets.length > 0 && doneSets.length === sets.length) completedExercises += 1;

      let liveBest = 0;
      let bestSet: { weightKg: number; reps: number } | null = null;
      for (const s of doneSets) {
        const kg = Number(s.kg || 0);
        const reps = Number(s.reps || 0);
        totalVolume += reps * kg;
        totalReps += reps;
        estRestSec += ex.restSeconds || DEFAULT_REST;
        if (kg > 0) {
          const oneRm = kg * (1 + reps / 30);
          if (oneRm > liveBest) {
            liveBest = oneRm;
            bestSet = { weightKg: kg, reps };
          }
        }
      }
      const historical = context.historicalBest[ex.exerciseId] ?? 0;
      if (bestSet && historical > 0 && liveBest > historical) {
        newRecords.push({ name: ex.name, weightKg: bestSet.weightKg, reps: bestSet.reps });
      }
      const remain = sets.length - doneSets.length;
      estRemainingSec += remain * ((ex.restSeconds || DEFAULT_REST) + 30);
    }

    return {
      completedSets,
      totalSets,
      completedExercises,
      totalVolume,
      totalReps,
      estRestSec,
      estRemainingSec,
      newRecords,
    };
  }, [activeExercises, setState, dynamicDone, context.historicalBest]);

  const activeCount = activeExercises.length;
  const pct = stats.totalSets > 0 ? Math.round((stats.completedSets / stats.totalSets) * 100) : 0;
  // Alles af zodra elke niet-overgeslagen oefening klaar is (ook als alles skipped is).
  const allDone = stats.completedExercises === activeCount;

  // Meelopende workout-klok.
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = new Date(startedAt).getTime();
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [startedAt]);

  const completionVisible = (allDone || showCompletion) && !dismissed;

  // Zodra het afrondscherm verschijnt (knop "Afronden" of alles klaar): stop een
  // eventueel lopende rusttimer zodat die niet doortikt op het eindscherm.
  useEffect(() => {
    if (completionVisible) timer.dismiss();
  }, [completionVisible, timer.dismiss]);

  return (
    <Fullscreenable className="relative flex flex-1 flex-col">
      {/* Sticky voortgangsbalk */}
      <div className="sticky top-[3.25rem] z-30 border-b border-border bg-surface-1/85 px-4 py-2.5 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5 text-xs font-semibold text-neutral-700">
            <span className="tabular-nums">
              {stats.completedExercises}/{activeCount}
            </span>
            <span className="text-neutral-400">{t("done")}</span>
          </span>
          <div className="flex-1">
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
              <m.div
                className="h-full rounded-full bg-accent-gradient"
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
          </div>
          <span className="shrink-0 font-display text-sm font-bold tabular-nums text-neutral-700">
            {pct}%
          </span>
          <span className="shrink-0 font-display text-sm font-bold tabular-nums text-neutral-500">
            {fmtClock(elapsed)}
          </span>
          {/* Rust-/set-timers voor deze sessie aan/uit */}
          <button
            type="button"
            role="switch"
            aria-checked={timersEnabled}
            aria-label={timersEnabled ? t("timersOn") : t("timersOff")}
            title={timersEnabled ? t("timersOn") : t("timersOff")}
            onClick={() => setTimers(!timersEnabled)}
            className={cn(
              "relative flex size-8 shrink-0 items-center justify-center rounded-full transition-colors active:scale-90",
              timersEnabled ? "bg-accent-soft text-accent" : "bg-surface-2 text-neutral-400"
            )}
          >
            <Timer className="size-4" />
            {!timersEnabled ? (
              <span className="absolute inset-x-1 top-1/2 h-0.5 -translate-y-1/2 rotate-45 rounded-full bg-current" />
            ) : null}
          </button>
          <FullscreenButton />
        </div>
        {!timersEnabled ? (
          <p className="mt-1.5 text-center text-[11px] font-medium text-neutral-400">
            {timersDefaultOn ? t("timersOffSession") : t("timersOffDefault")}
          </p>
        ) : null}
      </div>

      {/* Doorlopende oefeningenlijst */}
      <div className="flex flex-1 flex-col gap-5 px-4 pb-44 pt-5">
        {exList.map((ex, i) => {
          const showDay = Boolean(ex.dayName) && ex.dayName !== exList[i - 1]?.dayName;
          const isSkipped = skipped.has(ex.originalExerciseId);
          return (
            <div key={ex.originalExerciseId} className="flex flex-col gap-2">
              {showDay ? (
                <p className="px-1 text-xs font-semibold uppercase tracking-wide text-accent">
                  {ex.dayName}
                </p>
              ) : null}

              {isSkipped ? (
                <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border bg-surface-1/60 px-4 py-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-neutral-400">
                    <SkipForward className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-neutral-500 line-through">
                      {ex.name}
                    </p>
                    <p className="text-xs text-neutral-400">{t("skipped")}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => undoSkip(ex)}
                    className="flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-accent active:scale-95"
                  >
                    <RotateCcw className="size-3.5" /> {t("undo")}
                  </button>
                </div>
              ) : (
                <>
                  {ex.substitutedFrom ? (
                    <p className="flex items-center gap-1.5 px-1 text-[11px] font-medium text-neutral-400">
                      <Repeat className="size-3 text-accent" />
                      {t("substitutedFrom", { name: ex.substitutedFrom })}
                    </p>
                  ) : null}

                  {isStrength(ex) ? (
                    <ExerciseBlock
                      key={ex.exerciseId}
                      exercise={ex}
                      sets={setState[ex.exerciseId]}
                      note={notes[ex.exerciseId] ?? ""}
                      historicalBestOneRm={context.historicalBest[ex.exerciseId] ?? 0}
                      onChangeSet={(sn, field, val) => changeSet(ex.exerciseId, sn, field, val)}
                      onToggleSet={(sn) => toggleSet(ex, sn)}
                      onRetrySet={(sn) => retrySet(ex, sn)}
                      onAddSet={() => addSet(ex.exerciseId)}
                      onRemoveSet={(sn) => removeSet(ex.exerciseId, sn)}
                      onNoteChange={(val) => setNotes((p) => ({ ...p, [ex.exerciseId]: val }))}
                      onNoteBlur={() => noteBlur(ex.exerciseId)}
                    />
                  ) : (
                    <DynamicExerciseBlock
                      key={ex.exerciseId}
                      exercise={ex}
                      sessionId={sessionId}
                      saveLog={actions.saveLog}
                      onDoneChange={(done) =>
                        setDynamicDone((p) => ({ ...p, [ex.exerciseId]: done }))
                      }
                      onSetDone={(rest) => {
                        if (timersEnabled) timer.startRest(rest > 0 ? rest : DEFAULT_REST);
                      }}
                    />
                  )}

                  {/* Snelle acties: alternatief kiezen / oefening overslaan */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setAltFor(ex)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border py-2 text-xs font-semibold text-neutral-600 active:scale-[0.98]"
                    >
                      <Repeat className="size-3.5 text-accent" /> {t("chooseAlternative")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSkipFor(ex)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border py-2 text-xs font-semibold text-neutral-600 active:scale-[0.98]"
                    >
                      <SkipForward className="size-3.5" /> {t("skip")}
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => {
              setDismissed(false);
              setShowCompletion(true);
            }}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent-gradient px-6 py-4 text-center text-base font-bold text-accent-foreground shadow-accent active:scale-[0.98]"
          >
            <Check className="size-5" /> {t("finishWorkout")}
          </button>

          {/* Annuleren — subtiel onder afronden, met bevestiging. */}
          <button
            type="button"
            onClick={() => setConfirmCancel(true)}
            className="flex w-full items-center justify-center gap-1.5 rounded-2xl px-6 py-3 text-center text-sm font-medium text-neutral-400 active:bg-surface-2"
          >
            <X className="size-4" /> {t("cancelWorkout")}
          </button>
        </div>
      </div>

      <FloatingTimer timer={timer} />

      {/* Overslaan bevestigen */}
      <Modal open={skipFor !== null} onClose={() => setSkipFor(null)} title={t("skipConfirmTitle")}>
        <p className="text-sm text-neutral-600">
          {t("skipConfirmBody", { name: skipFor?.name ?? "" })}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setSkipFor(null)}
            className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-neutral-700 active:bg-surface-2"
          >
            {t("keep")}
          </button>
          <button
            type="button"
            onClick={confirmSkip}
            className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground active:opacity-90"
          >
            {t("skipConfirm")}
          </button>
        </div>
      </Modal>

      {/* Workout annuleren bevestigen */}
      <Modal
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        title={t("cancelConfirmTitle")}
      >
        <p className="text-sm text-neutral-600">{t("cancelConfirmBody")}</p>
        <div className="mt-5 flex flex-col gap-2">
          <form action={actions.cancelSession}>
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

      {/* Alternatief kiezen */}
      <AlternativesModal
        exercise={altFor}
        sessionId={sessionId}
        excludeIds={exList.map((e) => e.exerciseId)}
        getAlternatives={actions.getExerciseAlternatives}
        substitute={actions.substituteExercise}
        onClose={() => setAltFor(null)}
        onChosen={(ex, alt) => {
          applySubstitution(ex, alt);
          setAltFor(null);
        }}
      />

      <AnimatePresence>
        {completionVisible ? (
          <CompletionScreen
            sessionId={sessionId}
            endSession={actions.endSession}
            saveWorkoutMood={actions.saveWorkoutMood}
            cancelSession={actions.cancelSession}
            completedExercises={stats.completedExercises}
            totalExercises={activeCount}
            completedSets={stats.completedSets}
            totalReps={stats.totalReps}
            totalVolume={stats.totalVolume}
            durationSec={elapsed}
            estRestSec={stats.estRestSec}
            newRecords={stats.newRecords}
            streakWeeks={context.projectedStreakWeeks}
            weeklyGoal={context.weeklyGoal}
            weeklyGoalReached={context.weeklyGoalReached}
            workoutsThisWeek={context.workoutsThisWeekIncl}
            reward={reward}
            onContinue={() => {
              setShowCompletion(false);
              setDismissed(true);
            }}
          />
        ) : null}
      </AnimatePresence>
    </Fullscreenable>
  );
}

/**
 * Modal met alternatieve oefeningen (lazy geladen zodra 'ie opent). Toont een
 * nette lege staat als er geen zinnig alternatief is. Kiezen roept
 * `substituteExercise` aan en meldt de vervanger terug aan de sessie.
 */
function AlternativesModal({
  exercise,
  sessionId,
  excludeIds,
  getAlternatives,
  substitute,
  onClose,
  onChosen,
}: {
  exercise: ActiveExercise | null;
  sessionId: string;
  excludeIds: string[];
  getAlternatives: SessionActions["getExerciseAlternatives"];
  substitute: SessionActions["substituteExercise"];
  onClose: () => void;
  onChosen: (ex: ActiveExercise, alt: AlternativeSuggestion) => void;
}) {
  const t = useTranslations("member.active");
  const [loading, setLoading] = useState(false);
  const [alternatives, setAlternatives] = useState<AlternativeSuggestion[]>([]);
  const [choosing, setChoosing] = useState<string | null>(null);

  useEffect(() => {
    if (!exercise) return;
    let cancelled = false;
    setLoading(true);
    setAlternatives([]);
    getAlternatives({ exerciseId: exercise.exerciseId, excludeIds })
      .then((res) => {
        if (!cancelled) setAlternatives(res.ok ? res.alternatives : []);
      })
      .catch(() => {
        if (!cancelled) setAlternatives([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise?.exerciseId]);

  function choose(alt: AlternativeSuggestion) {
    if (!exercise) return;
    setChoosing(alt.exerciseId);
    substitute({
      sessionId,
      fromExerciseId: exercise.originalExerciseId,
      toExerciseId: alt.exerciseId,
    })
      .then((res) => {
        if (res.ok && res.replacement) {
          onChosen(exercise, {
            exerciseId: res.replacement.exerciseId,
            name: res.replacement.name,
            machineName: res.replacement.machineName,
            thumbUrl: res.replacement.thumbUrl,
            reason: alt.reason,
          });
        }
      })
      .finally(() => setChoosing(null));
  }

  return (
    <Modal open={exercise !== null} onClose={onClose} title={t("altTitle")}>
      {loading ? (
        <div className="flex items-center justify-center py-10 text-sm text-neutral-500">
          <span className="mr-2 size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          {t("altLoading")}
        </div>
      ) : alternatives.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-surface-2 text-neutral-400">
            <Repeat className="size-6" />
          </span>
          <p className="text-sm font-semibold text-neutral-800">{t("altEmptyTitle")}</p>
          <p className="text-sm text-neutral-500">{t("altEmptyBody")}</p>
        </div>
      ) : (
        <>
          <p className="mb-3 text-xs text-neutral-500">{t("altHint")}</p>
          <ul className="flex flex-col gap-2">
            {alternatives.map((alt) => (
              <li key={alt.exerciseId}>
                <button
                  type="button"
                  disabled={choosing !== null}
                  onClick={() => choose(alt)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-border bg-surface-1 p-3 text-left transition-colors active:scale-[0.99] disabled:opacity-60"
                >
                  {alt.thumbUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={alt.thumbUrl}
                      alt=""
                      aria-hidden
                      className="size-12 shrink-0 rounded-xl object-cover"
                    />
                  ) : (
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                      <Dumbbell className="size-5" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-sm font-bold text-neutral-900">
                      {alt.name}
                    </p>
                    <p className="truncate text-xs text-neutral-500">
                      {alt.reason}
                      {alt.machineName ? ` · ${alt.machineName}` : ""}
                    </p>
                  </div>
                  {choosing === alt.exerciseId ? (
                    <span className="size-4 shrink-0 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                  ) : (
                    <span className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground">
                      {t("altChoose")}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="mt-4 rounded-xl bg-surface-2 px-3 py-2 text-xs text-neutral-500">
        {t("altDisclaimer")}
      </p>
    </Modal>
  );
}
