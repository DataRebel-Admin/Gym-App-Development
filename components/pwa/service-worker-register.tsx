"use client";

import { useEffect } from "react";

/**
 * Registreert de service worker globaal bij het laden — nodig voor
 * PWA-installeerbaarheid en de offline-shell. Idempotent naast de push-toggle,
 * die dezelfde `/sw.js` registreert (dubbel registreren levert dezelfde
 * registration op). Progressive enhancement: faalt stil.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* stil — de app werkt ook zonder service worker */
      });
    };

    if (document.readyState === "complete") {
      register();
      return;
    }
    window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
