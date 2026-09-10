"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence, m } from "motion/react";
import { cn } from "@/lib/cn";
import { haptic } from "@/lib/haptics";
import {
  WATCH_EXTEND_SECONDS,
  cancelRestDoneNotification,
  consumeRestActions,
  onRestAction,
  scheduleRestDoneNotification,
  showRestDoneWebNotification,
  type RestDoneText,
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
  /**
   * De meldingscontext (oefeningnaam). Moet mee: na een reload plant elke
   * volgende actie (pauzeren/hervatten, "+30s" vanaf een horloge) de melding
   * opnieuw, en zonder deze waarde valt die terug op de algemene tekst — precies
   * de kale melding die de knoppen op je pols moesten vervangen.
   */
  context?: string;
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
  /**
   * `context` beschrijft waar de rust bij hoort (de oefeningnaam) en wordt de
   * body van de melding — op een smartwatch de enige regel die de gebruiker te
   * zien krijgt. Weglaten geeft de algemene tekst.
   */
  startRest: (seconds: number, context?: string) => void;
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

  // Waar deze rust bij hoort ("Bench Press"), gezet door startRest en hersteld
  // uit de persist-snapshot. Op een smartwatch is dit het verschil tussen een
  // bruikbare melding en een kale "Rust voorbij" waarvoor je alsnog je telefoon
  // pakt.
  const restContextRef = useRef(restored?.context ?? "");

  // De vertaalfunctie in een ref, zodat notifText hieronder stabiel kan zijn.
  // Dat moet: notifText hangt via `finish` aan de 250ms-interval, en een
  // wisselende identiteit zou die elke render opnieuw opzetten. Bijwerken in
  // een effect, want een ref schrijven tijdens render is een React-Compiler-fout.
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  /**
   * Bouwt de teksten van de "rust voorbij"-melding (native ingepland / web via
   * SW), inclusief de knoplabels. Bewust een functie en geen klaargezet object:
   * `startRest` zet de context en plant de melding in dezelfde tik, dus een bij
   * de vorige render gevulde waarde zou nog de vórige oefening noemen.
   */
  const notifText = useCallback((): RestDoneText => {
    const translate = tRef.current;
    return {
      title: translate("restDoneNotifTitle"),
      body: restContextRef.current || translate("restDoneNotifBody"),
      extendLabel: translate("restNotifExtend", { seconds: WATCH_EXTEND_SECONDS }),
      doneLabel: translate("restNotifDone"),
    };
  }, []);

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
        context: restContextRef.current,
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
        void showRestDoneWebNotification(notifText());
      } else {
        // In beeld: piep + trilling, en de vooruit ingeplande native melding
        // is niet meer nodig (voorkomt een dubbele melding).
        void cancelRestDoneNotification();
        if (settings.soundOn) playBeep();
        if (settings.vibrateOn) void haptic("medium", [180, 90, 180]);
      }
    },
    [duration, settings.soundOn, settings.vibrateOn, notifText]
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

  const startRest = useCallback(
    (seconds: number, context?: string) => {
      if (seconds <= 0) return;
      // Vóór het plannen zetten: notifText() leest deze ref meteen.
      restContextRef.current = context ?? "";
      setKind("countdown");
      setDuration(seconds);
      baseRef.current = 0;
      startTsRef.current = Date.now();
      setDisplayElapsed(0);
      setFinished(false);
      setRunning(true);
      setVisible(true);
      void scheduleRestDoneNotification(seconds * 1000, notifText());
    },
    [notifText]
  );

  const startStopwatch = useCallback(() => {
    // Een stopwatch hoort bij geen enkele rust, dus de context van de vorige
    // countdown mag niet blijven hangen in de persist-snapshot.
    restContextRef.current = "";
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
          void scheduleRestDoneNotification(remaining * 1000, notifText());
        }
      }
      return true;
    });
  }, [kind, duration, notifText]);

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
            void scheduleRestDoneNotification(remaining * 1000, notifText());
          } else {
            void cancelRestDoneNotification();
          }
        }
      }
    },
    [kind, finished, running, duration, notifText]
  );

  const dismiss = useCallback(() => {
    setRunning(false);
    setVisible(false);
    setFinished(false);
    baseRef.current = 0;
    setDisplayElapsed(0);
    restContextRef.current = "";
    void cancelRestDoneNotification();
  }, []);

  // De laatste versie van de acties + de zichtbaarheid, zodat het effect
  // hieronder zich één keer hoeft te registreren (het idioom van tRef hierboven:
  // refs i.p.v. deps).
  const addTimeRef = useRef(addTime);
  const dismissRef = useRef(dismiss);
  const visibleRef = useRef(visible);
  useEffect(() => {
    addTimeRef.current = addTime;
    dismissRef.current = dismiss;
    visibleRef.current = visible;
  }, [addTime, dismiss, visible]);

  /**
   * Speel de knop terug die op de melding is getikt, bijvoorbeeld vanaf een
   * gekoppelde smartwatch. Die wordt native afgehandeld terwijl de WebView
   * stilstaat, dus de timer in beeld weet er nog niets van.
   *
   * Drie momenten, omdat geen ervan op zichzelf betrouwbaar is: bij mount (de
   * app kwam net terug), op het plugin-seintje (de app draaide al) en bij
   * zichtbaar worden (vangnet als het seintje een geThrottlede WebView niet
   * bereikte). De wachtrij wordt bij het lezen geleegd, dus meerdere bronnen
   * kunnen dezelfde actie nooit dubbel toepassen.
   *
   * Alle drie zijn nodig, want de platforms vullen de wachtrij op een ander
   * moment. Op Android schrijft de BroadcastReceiver hem vóórdat de app start,
   * dus dekt de mount-lezing het. Op iOS levert het systeem de actie pas ná het
   * starten af, dus is daar juist het seintje het werkende pad.
   *
   * **Alleen de láátste actie telt.** De wachtrij is een log van tikken, maar
   * native houdt precies één ingeplande melding bij en elke tik vervangt de
   * vorige. Zou je ze allemaal toepassen, dan telt twee keer "+30s" hier 60
   * seconden op terwijl de melding op 30 staat, en loopt de timer in beeld door
   * nadat je horloge al getrild heeft.
   */
  useEffect(() => {
    let stopped = false;

    const applyPending = async () => {
      const actions = await consumeRestActions();
      if (stopped || actions.length === 0) return;
      // Geen timer in beeld (nooit gestart, of al weggeklikt): dan is er niets
      // om mee te synchroniseren en zou toepassen alleen losse state opleveren.
      // Wel de native planning opruimen: een "+30s" die vlak vóór het wegklikken
      // is getikt heeft daar een melding klaarstaan, en die zou straks afgaan
      // terwijl er helemaal geen rust meer loopt.
      if (!visibleRef.current) {
        void cancelRestDoneNotification();
        return;
      }

      const action = actions[actions.length - 1];
      if (action.type === "done") {
        dismissRef.current();
        return;
      }
      // Native plande de verlenging vanaf het moment van de tik; sindsdien is
      // er tijd verstreken. Alleen het restant toevoegen, anders loopt de timer
      // in beeld vóór op de melding die al is ingepland.
      const left = action.seconds - (Date.now() - action.at) / 1000;
      if (left > 0) addTimeRef.current(left);
    };

    void applyPending();
    const unsubscribe = onRestAction(() => void applyPending());
    const onVisibility = () => {
      if (document.visibilityState === "visible") void applyPending();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stopped = true;
      unsubscribe();
      document.removeEventListener("visibilitychange", onVisibility);
    };
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
          className="pointer-events-none fixed inset-x-0 bottom-[calc(4.75rem_+_env(safe-area-inset-bottom))] z-40 mx-auto max-w-md px-4 sm:max-w-lg"
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
