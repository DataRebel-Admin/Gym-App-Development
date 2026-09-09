"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence, m } from "motion/react";
import { cn } from "@/lib/cn";
import { haptic } from "@/lib/haptics";
import {
  cancelRestDoneNotification,
  scheduleRestDoneNotification,
  showRestDoneWebNotification,
} from "@/lib/workout-notifications";

export type TimerKind = "countdown" | "stopwatch";

const SETTINGS_KEY = "gymrebel-rest-settings";
const REST_PRESETS = [30, 60, 90, 120];

/**
 * Persist-snapshot van een lopende timer (localStorage, per sessie). Alleen
 * timestamps + configuratie — de verstreken tijd is altijd afgeleid van de
 * klok, dus wegnavigeren, een reload of een achtergrond-throttle verandert
 * niets aan het werkelijke verloop.
 */
type PersistedTimer = {
  kind: TimerKind;
  duration: number;
  base: number;
  startTs: number;
  running: boolean;
  visible: boolean;
  finished: boolean;
};

/** Herstelde staat + of de countdown al afliep terwijl de timer niet in beeld was. */
type RestoredTimer = PersistedTimer & { expiredWhileAway: boolean };

function restoreTimer(key: string | undefined): RestoredTimer | null {
  if (!key || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const p = JSON.parse(raw) as PersistedTimer;
    if (!p || !p.visible || (p.kind !== "countdown" && p.kind !== "stopwatch")) return null;
    if (p.running && p.kind === "countdown") {
      const el = p.base + (Date.now() - p.startTs) / 1000;
      if (el >= p.duration) {
        // Afgelopen terwijl we weg waren: herstel als "klaar", zónder piep of
        // trilling — de (native/web) melding heeft dat moment al gedekt.
        return { ...p, running: false, finished: true, base: p.duration, expiredWhileAway: true };
      }
    }
    return { ...p, expiredWhileAway: false };
  } catch {
    return null;
  }
}

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
 *
 * Met een `persistKey` (per sessie) overleeft de lopende timer een
 * schermwissel/reload: de staat wordt als timestamps bewaard en bij het
 * terugkomen exact hersteld — een countdown die intussen afliep herstelt als
 * "klaar" zonder de melding opnieuw af te vuren.
 *
 * Meldingen bij het aflopen (best-effort, nooit dubbel):
 * - Native (Capacitor): vooruit ingepland bij het starten (de WebView
 *   throttlet JS in de achtergrond), geannuleerd zodra de timer in beeld
 *   afloopt of stopt.
 * - Web/PWA: alléén als de pagina op het eindmoment verborgen is, via de
 *   service worker (met vaste tag). In beeld doen piep + trilling het werk.
 */
export function useRestTimer(persistKey?: string): RestTimer {
  const t = useTranslations("member.active");
  // Herstel een eerder gepersisteerde timer (lazy init — SSR-veilig door de
  // window-guard; de timer-UI is bij hydratie nog niet zichtbaar).
  const [restored] = useState<RestoredTimer | null>(() => restoreTimer(persistKey));
  const [kind, setKind] = useState<TimerKind>(restored?.kind ?? "countdown");
  const [duration, setDuration] = useState(restored?.duration ?? 0);
  const [running, setRunning] = useState(restored?.running ?? false);
  const [visible, setVisible] = useState(restored?.visible ?? false);
  const [finished, setFinished] = useState(restored?.finished ?? false);
  // Lazy init is SSR-veilig (loadSettings heeft een window-guard) en de timer-UI
  // is bij hydratie nog niet zichtbaar — geen mismatch-risico.
  const [settings, setSettings] = useState<Settings>(loadSettings);

  // Geaccumuleerde seconden (bij pauze) + starttijdstip van de lopende periode.
  const baseRef = useRef(restored?.base ?? 0);
  const startTsRef = useRef(restored?.startTs ?? 0);
  // Verstreken tijd voor weergave — bijgewerkt door de interval-tik (250ms),
  // zodat de render geen refs/klok hoeft te lezen.
  const [displayElapsed, setDisplayElapsed] = useState(() => {
    if (!restored) return 0;
    if (restored.running) {
      return Math.max(0, restored.base + (Date.now() - restored.startTs) / 1000);
    }
    return restored.base;
  });

  // Tekst van de "rust voorbij"-melding (native ingepland / web via SW).
  const notifTextRef = useRef({ title: "", body: "" });
  notifTextRef.current = { title: t("restDoneNotifTitle"), body: t("restDoneNotifBody") };

  // Liep de herstelde countdown al af terwijl we weg waren? Dan heeft de
  // (native) melding z'n werk gedaan — alleen nog opruimen, niets afspelen.
  useEffect(() => {
    if (restored?.expiredWhileAway) void cancelRestDoneNotification();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist de timer-staat (timestamps) zodat wegnavigeren niets verliest.
  useEffect(() => {
    if (!persistKey || typeof window === "undefined") return;
    try {
      if (!visible) {
        window.localStorage.removeItem(persistKey);
        return;
      }
      const snapshot: PersistedTimer = {
        kind,
        duration,
        base: baseRef.current,
        startTs: startTsRef.current,
        running,
        visible,
        finished,
      };
      window.localStorage.setItem(persistKey, JSON.stringify(snapshot));
    } catch {
      /* genegeerd */
    }
  }, [persistKey, kind, duration, running, visible, finished]);

  const persist = useCallback((next: Settings) => {
    setSettings(next);
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    } catch {
      /* genegeerd */
    }
  }, []);

  /**
   * Afronden van een countdown. `stale` = het eindmoment ligt al ruim achter
   * ons (afgelopen terwijl de app/pagina niet in beeld was): dan geen piep of
   * trilling meer — de melding heeft dat moment gedekt — alleen opruimen.
   */
  const finish = useCallback(
    (stale: boolean) => {
      baseRef.current = duration;
      setDisplayElapsed(duration);
      setRunning(false);
      setFinished(true);
      if (stale) {
        void cancelRestDoneNotification();
        return;
      }
      const hidden =
        typeof document !== "undefined" && document.visibilityState !== "visible";
      if (hidden) {
        // Niet in beeld: web toont een SW-melding (native heeft de vooruit
        // ingeplande melding al) — geen piep die niemand kan plaatsen.
        void showRestDoneWebNotification(notifTextRef.current);
      } else {
        // In beeld: piep + trilling, en de vooruit ingeplande native melding
        // is niet meer nodig (voorkomt een dubbele melding).
        void cancelRestDoneNotification();
        if (settings.soundOn) playBeep();
        if (settings.vibrateOn) void haptic("medium", [180, 90, 180]);
      }
    },
    [duration, settings.soundOn, settings.vibrateOn]
  );

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      const el = baseRef.current + (Date.now() - startTsRef.current) / 1000;
      setDisplayElapsed(el);
      // > 3s over tijd = de tik kwam pas bij terugkeer in beeld door (throttle).
      if (kind === "countdown" && el >= duration) finish(el - duration > 3);
    }, 250);
    return () => window.clearInterval(id);
  }, [running, kind, duration, finish]);

  const startRest = useCallback((seconds: number) => {
    if (seconds <= 0) return;
    setKind("countdown");
    setDuration(seconds);
    baseRef.current = 0;
    startTsRef.current = Date.now();
    setDisplayElapsed(0);
    setFinished(false);
    setRunning(true);
    setVisible(true);
    void scheduleRestDoneNotification(seconds * 1000, notifTextRef.current);
  }, []);

  const startStopwatch = useCallback(() => {
    setKind("stopwatch");
    setDuration(0);
    baseRef.current = 0;
    startTsRef.current = Date.now();
    setDisplayElapsed(0);
    setFinished(false);
    setRunning(true);
    setVisible(true);
    // Een stopwatch heeft geen eindmoment — eventuele countdown-melding weg.
    void cancelRestDoneNotification();
  }, []);

  const toggleRun = useCallback(() => {
    setRunning((r) => {
      if (r) {
        baseRef.current += (Date.now() - startTsRef.current) / 1000;
        void cancelRestDoneNotification();
        return false;
      }
      startTsRef.current = Date.now();
      setFinished(false);
      if (kind === "countdown") {
        const remaining = duration - baseRef.current;
        if (remaining > 0) {
          void scheduleRestDoneNotification(remaining * 1000, notifTextRef.current);
        }
      }
      return true;
    });
  }, [kind, duration]);

  const addTime = useCallback(
    (delta: number) => {
      if (kind === "countdown") {
        const next = Math.max(0, Math.round(duration + delta));
        setDuration(next);
        let resumed = false;
        if (finished) {
          // Bij het verlengen na afloop: hervat de countdown.
          startTsRef.current = Date.now();
          setFinished(false);
          setRunning(true);
          resumed = true;
        }
        if (running || resumed) {
          const el = resumed
            ? baseRef.current
            : baseRef.current + (Date.now() - startTsRef.current) / 1000;
          const remaining = next - el;
          if (remaining > 0) {
            void scheduleRestDoneNotification(remaining * 1000, notifTextRef.current);
          } else {
            void cancelRestDoneNotification();
          }
        }
      }
    },
    [kind, finished, running, duration]
  );

  const dismiss = useCallback(() => {
    setRunning(false);
    setVisible(false);
    setFinished(false);
    baseRef.current = 0;
    setDisplayElapsed(0);
    void cancelRestDoneNotification();
  }, []);

  const elapsed = Math.floor(displayElapsed);
  const remaining =
    kind === "countdown" ? Math.max(0, Math.ceil(duration - displayElapsed)) : 0;

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
  const t = useTranslations("member.active");
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
          className="pointer-events-none fixed inset-x-0 bottom-[4.75rem] z-40 mx-auto max-w-md px-4 sm:max-w-lg"
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
                    ? t("restDone")
                    : timer.kind === "countdown"
                      ? t("rest")
                      : t("stopwatch")}
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
                      label={t("secondsLess")}
                      onClick={() => timer.addTime(-15)}
                    >
                      −15
                    </RoundButton>
                    <RoundButton
                      label={t("secondsMore")}
                      onClick={() => timer.addTime(15)}
                    >
                      +15
                    </RoundButton>
                  </>
                ) : null}
                {!timer.finished ? (
                  <RoundButton
                    label={timer.running ? t("pause") : t("resume")}
                    onClick={timer.toggleRun}
                    variant="accent"
                  >
                    {timer.running ? "❚❚" : "▶"}
                  </RoundButton>
                ) : null}
                <RoundButton label={t("closeTimer")} onClick={timer.dismiss}>
                  {timer.finished ? t("ready") : "✕"}
                </RoundButton>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-border/60 px-4 py-2">
              <button
                type="button"
                onClick={() => setShowSettings((s) => !s)}
                className="text-xs font-medium text-neutral-500 active:text-neutral-900"
              >
                ⚙ {t("settings")}
              </button>
              <button
                type="button"
                onClick={timer.startStopwatch}
                className="text-xs font-medium text-neutral-500 active:text-neutral-900"
              >
                ⏱ {t("stopwatch")}
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
                          {t("restPreset", { seconds: p })}
                        </button>
                      ))}
                    </div>
                    <label className="flex items-center justify-between text-sm text-neutral-700">
                      {t("soundOnEnd")}
                      <input
                        type="checkbox"
                        checked={timer.soundOn}
                        onChange={(e) => timer.setSoundOn(e.target.checked)}
                        className="size-5 accent-[var(--tenant-accent)]"
                      />
                    </label>
                    <label className="flex items-center justify-between text-sm text-neutral-700">
                      {t("vibrateOnEnd")}
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
