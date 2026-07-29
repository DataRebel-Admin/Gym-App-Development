"use client";

import { useSyncExternalStore } from "react";

// Leeg abonnement: de waarde verandert niet via externe events; we willen alleen
// het snapshot-gedrag van useSyncExternalStore (server-fallback tot hydratie,
// direct daarna de echte clientwaarde) zonder setState-in-effect.
const emptySubscribe = () => () => {};

/**
 * Leest een client-only waarde (browser-API, DOM, localStorage). Tijdens SSR en
 * hydratie geldt `serverValue`; direct na hydratie de echte clientwaarde.
 * `getValue` moet goedkoop en idempotent zijn en een primitief (of referentieel
 * stabiel) resultaat teruggeven.
 */
export function useClientValue<T>(getValue: () => T, serverValue: T): T {
  return useSyncExternalStore(emptySubscribe, getValue, () => serverValue);
}

/** `true` zodra de component client-side gehydrateerd is (voor portals e.d.). */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

function subscribeToStorage(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

/**
 * Rauwe localStorage-waarde als external store: `null` tijdens SSR/hydratie én
 * wanneer de sleutel ontbreekt of localStorage geblokkeerd is. Schrijft zelf
 * niet — wie muteert, houdt daarnaast een eigen override-state bij (het
 * `storage`-event vuurt niet in de eigen tab).
 */
export function useLocalStorageItem(key: string): string | null {
  return useSyncExternalStore(
    subscribeToStorage,
    () => {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    () => null
  );
}
