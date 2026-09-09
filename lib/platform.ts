import { useSyncExternalStore } from "react";
import { Capacitor } from "@capacitor/core";

/**
 * Welk toestel draait de UI? Alleen vanuit client-componenten gebruiken.
 *
 * De server kent het toestel niet, dus `usePlatform()` rendert server-side
 * (en tijdens hydratie) altijd "desktop" en wisselt daarna naar het echte
 * platform — via `useSyncExternalStore`, zodat er geen setState-in-effect
 * nodig is en de hydratie klopt. In de Capacitor-app is `Capacitor.getPlatform()`
 * leidend; in een browser valt het terug op de user-agent.
 */
export type Platform = "android" | "ios" | "desktop";

export function detectPlatform(): Platform {
  try {
    const native = Capacitor.getPlatform();
    if (native === "android" || native === "ios") return native;
  } catch {
    // buiten Capacitor: valt door naar de user-agent
  }
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return "android";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  // iPadOS meldt zich als Macintosh, maar wel met touch.
  if (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1) return "ios";
  return "desktop";
}

/** Draaien we in de Capacitor-app? (web/PWA → false) */
export function isNativePlatform(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

// Snapshots: één keer bepaald, daarna stabiel (de hook vergelijkt op
// identiteit, dus een verse berekening per render zou een lus geven).
let platformCache: Platform | null = null;
function platformSnapshot(): Platform {
  if (platformCache === null) platformCache = detectPlatform();
  return platformCache;
}
let nativeCache: boolean | null = null;
function nativeSnapshot(): boolean {
  if (nativeCache === null) nativeCache = isNativePlatform();
  return nativeCache;
}
const noSubscribe = () => () => {};

export function usePlatform(): Platform {
  return useSyncExternalStore(noSubscribe, platformSnapshot, () => "desktop" as const);
}

export function useIsNativeApp(): boolean {
  return useSyncExternalStore(noSubscribe, nativeSnapshot, () => false);
}
