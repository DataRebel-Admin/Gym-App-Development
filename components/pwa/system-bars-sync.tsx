"use client";

import { useEffect } from "react";
import {
  Capacitor,
  SystemBars,
  SystemBarsStyle,
  SystemBarType,
} from "@capacitor/core";

/**
 * Laat de iconen in de statusbalk (klok, wifi, batterij) het app-thema volgen.
 *
 * Sinds `viewport-fit=cover` (app/layout.tsx) staan die iconen op de glazen
 * strook bovenin, en die heeft de kleur van het app-thema. Dat thema is een
 * eigen keuze (cookie, standaard donker; /login en /invite altijd licht) en loopt
 * dus niet gelijk met de systeemmodus waar Capacitor standaard op stuurt. Zonder
 * deze sync gaf een telefoon in donkere modus met de app in licht witte iconen
 * op een witte strook.
 *
 * Let op de Capacitor-semantiek: `Dark` betekent "lichte iconen voor een donkere
 * ondergrond", dus donker thema → `Dark`.
 *
 * Beide plugins krijgen dezelfde stijl. SystemBars (core) én @capacitor/status-bar
 * herstellen allebei hun eigen stijl bij een configuratiewijziging (draaien,
 * donkere modus aan/uit), in willekeurige volgorde; stond er in één van de twee
 * nog DEFAULT, dan won af en toe alsnog de systeemmodus.
 *
 * Bewust alleen de statusbalk: op Android 14 en lager is de navigatiebalk een
 * dichte balk in de systeemkleur, en de iconen daar op het app-thema zetten gaf
 * donkere knoppen op zwart.
 *
 * No-op op web. Faalt stil: een verkeerde iconkleur is geen reden om te crashen.
 */
export function SystemBarsSync() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const root = document.documentElement;
    const apply = () => {
      // Zelfde lezing als de thema-toggle: alles behalve "light" is donker.
      const dark = root.dataset.theme !== "light";
      void SystemBars.setStyle({
        bar: SystemBarType.StatusBar,
        style: dark ? SystemBarsStyle.Dark : SystemBarsStyle.Light,
      }).catch(() => {});
      void import("@capacitor/status-bar")
        .then(({ StatusBar, Style }) =>
          StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light })
        )
        .catch(() => {});
    };

    apply();
    // De thema-toggle zet alleen `data-theme` om, zonder server-render.
    const observer = new MutationObserver(apply);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  return null;
}
