import { registerPlugin } from "@capacitor/core";
import { isNativeApp } from "@/lib/app-lock";

/**
 * Meldingen rond de actieve workout, met een native laag op Android
 * (lokale plugin `WorkoutNotifications`, zie
 * android/app/src/main/java/nl/gymrebeltraining/app/WorkoutNotificationsPlugin.java)
 * en een service-worker-fallback op web/PWA. Client-only (Capacitor/navigator);
 * alleen importeren vanuit client-componenten — zelfde regel als lib/app-lock.ts.
 *
 * Twee meldingen:
 * - **Rusttimer afgelopen** — native wordt de melding bij het stárten van de
 *   timer vooruit ingepland (de WebView throttlet JS in de achtergrond, dus
 *   een melding pas bij `finish()` komt daar te laat) en geannuleerd zodra de
 *   timer stopt/pauzeert/afloopt in beeld. Web toont 'm alleen als de pagina
 *   op het eindmoment verborgen is; de `tag` voorkomt dubbele meldingen.
 * - **Blijvende "training bezig"** — alleen native (web kent geen ongoing-
 *   notificaties): chronometer die meeloopt vanaf de starttijd, tik = terug
 *   naar de actieve training, weg zodra de sessie eindigt.
 *
 * Alles is best-effort: zonder permissie of plugin degradeert elke functie stil.
 */

type WorkoutNotificationsApi = {
  showOngoing(options: {
    title: string;
    text: string;
    startedAtMs: number;
    url: string;
  }): Promise<void>;
  clearOngoing(): Promise<void>;
  scheduleRestDone(options: {
    inMs: number;
    title: string;
    body: string;
    url: string;
  }): Promise<void>;
  cancelRestDone(): Promise<void>;
};

let plugin: WorkoutNotificationsApi | null = null;

function workoutNotifications(): WorkoutNotificationsApi {
  // Lazy: registerPlugin niet op module-load draaien (idioom lib/app-lock.ts).
  plugin ??= registerPlugin<WorkoutNotificationsApi>("WorkoutNotifications");
  return plugin;
}

/** Web-tag: één melding tegelijk — een nieuwe vervangt de oude (geen dubbelen). */
const REST_DONE_TAG = "gymrebel-rest-timer";

/** De actieve-trainingspagina als absolute URL (werkt op elk (sub)domein). */
function activeSessionUrl(): string {
  return `${window.location.origin}/member/schema/active`;
}

/** Plan de "rust voorbij"-melding vooruit (alleen native; web kan niet vooruitplannen). */
export async function scheduleRestDoneNotification(
  inMs: number,
  text: { title: string; body: string }
): Promise<void> {
  if (!isNativeApp() || inMs <= 0) return;
  try {
    await workoutNotifications().scheduleRestDone({
      inMs,
      title: text.title,
      body: text.body,
      url: activeSessionUrl(),
    });
  } catch {
    /* plugin niet beschikbaar — stil degraderen */
  }
}

/** Annuleer een vooruit ingeplande "rust voorbij"-melding (native). */
export async function cancelRestDoneNotification(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    await workoutNotifications().cancelRestDone();
  } catch {
    /* genegeerd */
  }
}

/**
 * Toon de "rust voorbij"-melding nú via de service worker (web/PWA). Alleen
 * zinvol als de pagina verborgen is — in beeld doen piep + trilling het werk al.
 * De bestaande `notificationclick`-handler in public/sw.js opent `data.url`.
 */
export async function showRestDoneWebNotification(text: {
  title: string;
  body: string;
}): Promise<void> {
  if (isNativeApp()) return; // native loopt via de vooruit ingeplande melding
  try {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const reg = await navigator.serviceWorker?.getRegistration();
    await reg?.showNotification(text.title, {
      body: text.body,
      tag: REST_DONE_TAG,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      data: { url: "/member/schema/active" },
    });
  } catch {
    /* geen SW of geen permissie — stil degraderen */
  }
}

/** Toon/ververs de blijvende "training bezig"-melding (alleen native). */
export async function showOngoingWorkoutNotification(options: {
  title: string;
  text: string;
  startedAtMs: number;
}): Promise<void> {
  if (!isNativeApp()) return;
  try {
    await workoutNotifications().showOngoing({
      ...options,
      url: activeSessionUrl(),
    });
  } catch {
    /* genegeerd */
  }
}

/** Ruim de blijvende "training bezig"-melding op (sessie klaar/geannuleerd). */
export async function clearOngoingWorkoutNotification(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    await workoutNotifications().clearOngoing();
  } catch {
    /* genegeerd */
  }
}
