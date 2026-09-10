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
 *
 * ## Smartwatch
 *
 * Android spiegelt meldingen naar een gekoppeld horloge (Wear OS, Galaxy Watch),
 * dus de rustmelding kwam daar altijd al aan — je kon er alleen niets mee. De
 * rustmelding draagt daarom twee knoppen, `extendLabel` ("+30s") en `doneLabel`
 * ("Klaar"), die native worden afgehandeld zonder de telefoon te ontgrendelen.
 *
 * Wat je op je pols tikt komt via `consumeRestActions()` terug in de timer-UI.
 * Dat is een **wachtrij**, geen event-payload: de WebView is op dat moment
 * doorgaans geThrottled of dood, en een gemist event zou de timer in beeld uit
 * de pas laten lopen met de melding op je pols. `onRestAction()` is enkel een
 * seintje "consumeer nu"; de wachtrij blijft de bron van waarheid.
 *
 * Bewust géén knoppen op de **web/PWA**-melding. `showNotification` ondersteunt
 * `actions` wel, maar de service worker kan de timer-state (localStorage, van de
 * pagina) niet aanpassen en de pagina die dat wél kan is juist weg op het moment
 * dat de knop ertoe doet. Half werkende knoppen zijn erger dan geen knoppen; de
 * native app is het pad waarop smartwatch-bediening klopt.
 */

/**
 * Met hoeveel seconden de "+30s"-knop de rust verlengt.
 *
 * MOET gelijk blijven aan `EXTEND_SECONDS` in WorkoutNotificationsPlugin.java:
 * de knop wordt daar native afgehandeld, hier alleen gelabeld en teruggespeeld
 * in de timer. Lopen ze uiteen, dan telt het label iets anders op dan de melding.
 */
export const WATCH_EXTEND_SECONDS = 30;

/** Een knop die op de melding (of op een horloge) is getikt. */
export type RestAction = {
  type: "extend" | "done";
  /** Bij "extend": met hoeveel seconden de rust is verlengd. */
  seconds: number;
  /** Tijdstip van de tik (epoch ms), om te corrigeren voor de vertraging. */
  at: number;
};

/** Teksten van de "rust voorbij"-melding, inclusief de knoplabels. */
export type RestDoneText = {
  title: string;
  body: string;
  /** Label van de verleng-knop. Leeg = geen knop. */
  extendLabel?: string;
  /** Label van de klaar-knop. Leeg = geen knop. */
  doneLabel?: string;
};

type ListenerHandle = { remove: () => Promise<void> };

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
    extendLabel: string;
    doneLabel: string;
  }): Promise<void>;
  cancelRestDone(): Promise<void>;
  consumePendingActions(): Promise<{ actions: RestAction[] }>;
  addListener(eventName: "restAction", listener: () => void): Promise<ListenerHandle>;
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
  text: RestDoneText
): Promise<void> {
  if (!isNativeApp() || inMs <= 0) return;
  try {
    await workoutNotifications().scheduleRestDone({
      inMs,
      title: text.title,
      body: text.body,
      extendLabel: text.extendLabel ?? "",
      doneLabel: text.doneLabel ?? "",
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
 * Haal de knoppen op die sinds de vorige keer op de melding zijn getikt, en
 * leeg de wachtrij. Eenmalig: elke actie komt precies één keer terug.
 */
export async function consumeRestActions(): Promise<RestAction[]> {
  if (!isNativeApp()) return [];
  try {
    const result = await workoutNotifications().consumePendingActions();
    const actions = result?.actions;
    if (!Array.isArray(actions)) return [];
    // Streng valideren: de aanroeper rekent met deze getallen, en een ontbrekend
    // veld zou stil NaN opleveren in plaats van een zichtbare fout.
    return actions.filter(
      (a): a is RestAction =>
        !!a &&
        (a.type === "extend" || a.type === "done") &&
        Number.isFinite(a.at) &&
        Number.isFinite(a.seconds)
    );
  } catch {
    return [];
  }
}

/**
 * Seintje dat er een actie klaarstaat. Draagt bewust geen gegevens — de
 * aanroeper haalt ze op met `consumeRestActions()`, zodat een actie nooit
 * twee keer wordt toegepast. Geeft een opruimfunctie terug.
 */
export function onRestAction(callback: () => void): () => void {
  if (!isNativeApp()) return () => {};
  let handle: ListenerHandle | null = null;
  let cancelled = false;
  void (async () => {
    try {
      const registered = await workoutNotifications().addListener("restAction", callback);
      // De component kan al zijn opgeruimd terwijl de registratie liep.
      if (cancelled) void registered.remove();
      else handle = registered;
    } catch {
      /* plugin niet beschikbaar — stil degraderen */
    }
  })();
  return () => {
    cancelled = true;
    void handle?.remove();
    handle = null;
  };
}

/**
 * Toon de "rust voorbij"-melding nú via de service worker (web/PWA). Alleen
 * zinvol als de pagina verborgen is — in beeld doen piep + trilling het werk al.
 * De bestaande `notificationclick`-handler in public/sw.js opent `data.url`.
 */
export async function showRestDoneWebNotification(text: RestDoneText): Promise<void> {
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
