"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";

/**
 * Vangt links die de app van buitenaf openen (App Links op Android, Universal
 * Links op iOS) en navigeert de WebView naar het juiste pad.
 *
 * ## Waarom dit nodig is
 *
 * De assetlinks- en AASA-koppeling zorgen er alleen voor dat het *systeem* de app
 * opent in plaats van de browser. Wélke pagina daarna getoond wordt, is aan ons:
 * zonder deze listener start de app gewoon op de startpagina en is de klik
 * effectief verloren. Dat maakt precies de belangrijkste links stuk:
 *
 *  - de magic link uit een inlogmail (`/api/auth/callback/...`, `/login/magic`)
 *  - een uitnodiging (`/invite/<token>`)
 *  - een wachtwoord-reset (`/login/reset/<token>`)
 *  - een apparaat-QR die iemand doorstuurt (`/m/<token>`)
 *
 * ## Waarom `window.location` en geen router
 *
 * De inlogpaden zijn route-handlers die met cookies en redirects werken, geen
 * client-side routes. Een `router.push()` zou de RSC-payload ophalen in plaats
 * van de redirect te volgen. Een volledige navigatie doet precies wat de browser
 * ook zou doen, en dat is hier het gewenste gedrag.
 *
 * No-op op web: daar handelt de browser links zelf af.
 */
export function DeepLinkHandler() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let cancelled = false;
    let remove: (() => void) | undefined;

    void (async () => {
      try {
        const { App } = await import("@capacitor/app");
        const handle = await App.addListener("appUrlOpen", ({ url }) => {
          if (cancelled) return;

          let target: URL;
          try {
            target = new URL(url);
          } catch {
            return;
          }

          // Alleen links naar de eigen host volgen. Een App Link kán in principe
          // niet van een ander domein komen (het systeem matcht op host), maar
          // een custom scheme wél: `nl.gymrebeltraining.app://...` is door elke
          // app op het toestel af te vuren. Zonder deze check kon een andere app
          // onze WebView naar een willekeurige pagina sturen.
          if (target.host && target.host !== window.location.host) return;

          const path = `${target.pathname}${target.search}${target.hash}`;
          if (!path.startsWith("/")) return;

          // Al op de doelpagina? Dan niets doen, anders herlaadt hij onnodig.
          const current = `${window.location.pathname}${window.location.search}`;
          if (path === current) return;

          window.location.assign(path);
        });
        if (cancelled) {
          void handle.remove();
          return;
        }
        remove = () => void handle.remove();
      } catch {
        /* stil — plugin niet beschikbaar */
      }
    })();

    return () => {
      cancelled = true;
      remove?.();
    };
  }, []);

  return null;
}
