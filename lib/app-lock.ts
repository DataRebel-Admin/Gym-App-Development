import { Capacitor, registerPlugin } from "@capacitor/core";

/**
 * Web-kant van de native app-vergrendeling (AppLockPlugin.java): de app opent
 * met de kale toestel-biometrie (vingerafdruk/gezicht, pincode als terugval) —
 * de bank-app-ervaring, zonder Google's passkey/credential-manager-laag.
 *
 * Bewust een SLOT op de al-ingelogde app, geen inlogmethode: de sessie blijft
 * gewoon de JWT-cookie, dit bewaakt alleen de toegang tot het scherm. De
 * voorkeur is per toestel (localStorage) want het toestel ís de factor.
 * Buiten de Capacitor-app is alles hier een no-op; de browser houdt de
 * passkey-flow. Alleen vanuit client-componenten gebruiken (leest `window`).
 */
type AppLockPluginApi = {
  isAvailable(): Promise<{ available: boolean }>;
  verify(options: { title: string; subtitle?: string }): Promise<{ verified: boolean; code?: number }>;
};

let plugin: AppLockPluginApi | null = null;
function appLock(): AppLockPluginApi {
  plugin ??= registerPlugin<AppLockPluginApi>("AppLock");
  return plugin;
}

const ENABLED_KEY = "gymrebel-app-lock";
const PROMPT_DISMISSED_PREFIX = "gymrebel-app-lock-prompt-";

/** Ontgrendeld gedurende deze app-start (module-state: een koude start begint
 *  met een verse JS-context en is dus weer vergrendeld — precies de gekozen
 *  "alleen bij koude start"-regel; client-navigaties behouden de state). */
let unlockedThisLaunch = false;

export function isUnlockedThisLaunch(): boolean {
  return unlockedThisLaunch;
}

export function markUnlockedThisLaunch(): void {
  unlockedThisLaunch = true;
}

/** Draaien we in de Capacitor-app? (web/PWA → false) */
export function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/** Kan dit toestel vergrendelen (biometrie of schermvergrendeling aanwezig)? */
export async function appLockAvailable(): Promise<boolean> {
  if (!isNativeApp()) return false;
  try {
    return (await appLock().isAvailable()).available;
  } catch {
    return false;
  }
}

/** Toon de systeemprompt; true = ontgrendeld. Faalt nooit hard. */
export async function verifyAppLock(title: string, subtitle?: string): Promise<boolean> {
  try {
    return (await appLock().verify({ title, subtitle })).verified;
  } catch {
    return false;
  }
}

export function appLockEnabled(): boolean {
  try {
    return window.localStorage.getItem(ENABLED_KEY) === "1";
  } catch {
    return false;
  }
}

export function setAppLockEnabled(on: boolean): void {
  try {
    if (on) window.localStorage.setItem(ENABLED_KEY, "1");
    else window.localStorage.removeItem(ENABLED_KEY);
  } catch {
    /* genegeerd */
  }
}

/** "Niet nu" op de instel-vraag, per gebruiker per toestel (patroon passkey-prompt). */
export function appLockPromptDismissed(userId: string): boolean {
  try {
    return Boolean(window.localStorage.getItem(PROMPT_DISMISSED_PREFIX + userId));
  } catch {
    return true;
  }
}

export function dismissAppLockPrompt(userId: string): void {
  try {
    window.localStorage.setItem(PROMPT_DISMISSED_PREFIX + userId, "1");
  } catch {
    /* genegeerd */
  }
}
