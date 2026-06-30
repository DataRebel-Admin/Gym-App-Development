"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { cn } from "@/lib/cn";

export type TimerKind = "countdown" | "stopwatch";

const SETTINGS_KEY = "gymrebel-rest-settings";
const REST_PRESETS = [30, 60, 90, 120];

type Settings = { soundOn: boolean; vibrateOn: boolean };

function loadSettings(): Settings {
  if (typeof window === "undefined") return { soundOn: true, vibrateOn: true };
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (raw) return { soundOn: true, vibrateOn: true, ...JSON.parse(raw) };
  } catch {
    /* genegeerd */
  }
  return { soundOn: true, vibrateOn: true };
}

/** Korte, vriendelijke driedubbele piep via de Web Audio API. */
function playBeep() {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    [0, 0.18, 0.36].forEach((offset, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.type = "sine";
      o.frequency.value = i === 2 ? 1175 : 880; // laatste piep iets hoger
      const t = now + offset;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
      o.start(t);
      o.stop(t + 0.16);
    });
    window.setTimeout(() => ctx.close().catch(() => {}), 800);
  } catch {
    /* audio niet beschikbaar — stil falen */
  }
}

export type RestTimer = {
  visible: boolean;
  running: boolean;
  finished: boolean;
  kind: TimerKind;
  duration: number;
  remaining: number;
  elapsed: number;
  soundOn: boolean;
  vibrateOn: boolean;
  startRest: (seconds: number) => void;
  startStopwatch: () => void;
  addTime: (delta: number) => void;
  toggleRun: () => void;
  dismiss: () => void;
  setSoundOn: (v: boolean) => void;
  setVibrateOn: (v: boolean) => void;
};

/**
 * Rusttimer-logica: countdown (auto na een set) én stopwatch. Tijdmeting op
 * basis van timestamps (geen drift), met geluid + trilling bij het einde van een
 * countdown. Instellingen (geluid/trilling) bewaard in localStorage.
 */
export function useRestTimer(): RestTimer {
  const [kind, setKind] = useState<TimerKind>("countdown");
  const [duration, setDuration] = useState(0);
  const [running, setRunning] = useState(false);
  const [visible, setVisible] = useState(false);
  const [finished, setFinished] = useState(false);
  const [settings, setSettings] = useState<Settings>({
    soundOn: true,
    vibrateOn: true,
  });

  // Geaccumuleerde seconden (bij pauze) + starttijdstip van de lopende periode.
  const baseRef = useRef(0);
  const startTsRef = useRef(0);
  // Re-render-tik terwijl de timer loopt.
  const [, force] = useState(0);

  useEffect(() => setSettings(loadSettings()), []);

  const persist = useCallback((next: Settings) => {
    setSettings(next);
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    } catch {
      /* genegeerd */
    }
  }, []);

  const currentElapsed = useCallback(() => {
    const live = running ? (Date.now() - startTsRef.current) / 1000 : 0;
    return baseRef.current + live;
  }, [running]);

  const finish = useCallback(() => {
    baseRef.current = duration;
    setRunning(false);
    setFinished(true);
    if (settings.soundOn) playBeep();
    if (settings.vibrateOn && typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate([180, 90, 180]);
    }
  }, [duration, settings.soundOn, settings.vibrateOn]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      force((n) => n + 1);
      if (kind === "countdown") {
        const el = baseRef.current + (Date.now() - startTsRef.current) / 1000;
        if (el >= duration) finish();
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [running, kind, duration, finish]);

  const startRest = useCallback((seconds: number) => {
    if (seconds <= 0) return;
    setKind("countdown");
    setDuration(seconds);
    baseRef.current = 0;
    startTsRef.current = Date.now();
    setFinished(false);
    setRunning(true);
    setVisible(true);
  }, []);

  const startStopwatch = useCallback(() => {
    setKind("stopwatch");
    setDuration(0);
    baseRef.current = 0;
    startTsRef.current = Date.now();
    setFinished(false);
    setRunning(true);
    setVisible(true);
  }, []);

  const toggleRun = useCallback(() => {
    setRunning((r) => {
      if (r) {
        baseRef.current += (Date.now() - startTsRef.current) / 1000;
        return false;
      }
      startTsRef.current = Date.now();
      setFinished(false);
      return true;
    });
  }, []);

  const addTime = useCallback(
    (delta: number) => {
      if (kind === "countdown") {
        setDuration((d) => Math.max(0, Math.round(d + delta)));
        if (finished) {
          // Bij het verlengen na afloop: hervat de countdown.
          startTsRef.current = Date.now();
          setFinished(false);
          setRunning(true);
        }
      }
    },
    [kind, finished]
  );

  const dismiss = useCallback(() => {
    setRunning(false);
    setVisible(false);
    setFinished(false);
    baseRef.current = 0;
  }, []);

  const elapsed = Math.floor(currentElapsed());
  const remaining =
    kind === "countdown" ? Math.max(0, Math.ceil(duration - currentElapsed())) : 0;

  return {
    visible,
    running,
    finished,
    kind,
    duration,
    remaining,
    elapsed,
    soundOn: settings.soundOn,
    vibrateOn: settings.vibrateOn,
    startRest,
    startStopwatch,
    addTime,
    toggleRun,
    dismiss,
    setSoundOn: (v) => persist({ ...settings, soundOn: v }),
    setVibrateOn: (v) => persist({ ...settings, vibrateOn: v }),
  };
}

function fmt(total: number) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function RoundButton({
  onClick,
  label,
  children,
  variant = "neutral",
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
  variant?: "neutral" | "accent";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "flex h-12 min-w-12 items-center justify-center rounded-full px-3 text-sm font-semibold active:scale-95",
        variant === "accent"
          ? "bg-accent text-accent-foreground"
          : "bg-surface-2 text-neutral-700"
      )}
    >
      {children}
    </button>
  );
}

/**
 * Zwevende rusttimer die zichtbaar blijft tijdens de workout. Toont een grote
 * afteller, een voortgangsbalk en grote bedienknoppen. Verschijnt boven de
 * onderbalk.
 */
export function FloatingTimer({ timer }: { timer: RestTimer }) {
  const [showSettings, setShowSettings] = useState(false);

  const big = timer.kind === "countdown" ? timer.remaining : timer.elapsed;
  const progress =
    timer.kind === "countdown" && timer.duration > 0
      ? Math.min(100, ((timer.duration - timer.remaining) / timer.duration) * 100)
      : 0;

  return (
    <AnimatePresence>
      {timer.visible ? (
        <m.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="pointer-events-none fixed inset-x-0 bottom-[4.75rem] z-40 mx-auto max-w-md px-4"
        >
          <div
            className={cn(
              "pointer-events-auto overflow-hidden rounded-2xl border shadow-lg backdrop-blur",
              timer.finished
                ? "border-accent bg-accent-soft"
                : "border-border bg-surface-1/95"
            )}
          >
            {timer.kind === "countdown" ? (
              <div className="h-1.5 w-full bg-surface-2">
                <m.div
                  className="h-full bg-accent"
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.25, ease: "linear" }}
                />
              </div>
            ) : null}

            <div className="flex items-center gap-3 px-4 py-3">
              <div className="flex flex-col">
                <span className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
                  {timer.finished
                    ? "Rust klaar 💪"
                    : timer.kind === "countdown"
                      ? "Rust"
                      : "Stopwatch"}
                </span>
                <span
                  className={cn(
                    "font-display text-3xl font-bold tabular-nums leading-none",
                    timer.finished ? "text-accent" : "text-neutral-900"
                  )}
                >
                  {fmt(big)}
                </span>
              </div>

              <div className="ml-auto flex items-center gap-2">
                {timer.kind === "countdown" ? (
                  <>
                    <RoundButton
                      label="15 seconden minder"
                      onClick={() => timer.addTime(-15)}
                    >
                      −15
                    </RoundButton>
                    <RoundButton
                      label="15 seconden meer"
                      onClick={() => timer.addTime(15)}
                    >
                      +15
                    </RoundButton>
                  </>
                ) : null}
                {!timer.finished ? (
                  <RoundButton
                    label={timer.running ? "Pauzeer" : "Hervat"}
                    onClick={timer.toggleRun}
                    variant="accent"
                  >
                    {timer.running ? "❚❚" : "▶"}
                  </RoundButton>
                ) : null}
                <RoundButton label="Sluit timer" onClick={timer.dismiss}>
                  {timer.finished ? "Klaar" : "✕"}
                </RoundButton>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-border/60 px-4 py-2">
              <button
                type="button"
                onClick={() => setShowSettings((s) => !s)}
                className="text-xs font-medium text-neutral-500 active:text-neutral-900"
              >
                ⚙ Instellingen
              </button>
              <button
                type="button"
                onClick={timer.startStopwatch}
                className="text-xs font-medium text-neutral-500 active:text-neutral-900"
              >
                ⏱ Stopwatch
              </button>
            </div>

            <AnimatePresence>
              {showSettings ? (
                <m.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden border-t border-border/60"
                >
                  <div className="flex flex-col gap-3 px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {REST_PRESETS.map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => timer.startRest(p)}
                          className="rounded-full bg-surface-2 px-3 py-1.5 text-xs font-semibold text-neutral-700 active:scale-95"
                        >
                          {p}s rust
                        </button>
                      ))}
                    </div>
                    <label className="flex items-center justify-between text-sm text-neutral-700">
                      Geluid bij einde
                      <input
                        type="checkbox"
                        checked={timer.soundOn}
                        onChange={(e) => timer.setSoundOn(e.target.checked)}
                        className="size-5 accent-[var(--tenant-accent)]"
                      />
                    </label>
                    <label className="flex items-center justify-between text-sm text-neutral-700">
                      Trilling bij einde
                      <input
                        type="checkbox"
                        checked={timer.vibrateOn}
                        onChange={(e) => timer.setVibrateOn(e.target.checked)}
                        className="size-5 accent-[var(--tenant-accent)]"
                      />
                    </label>
                  </div>
                </m.div>
              ) : null}
            </AnimatePresence>
          </div>
        </m.div>
      ) : null}
    </AnimatePresence>
  );
}
