"use client";

import { useEffect } from "react";
import {
  Capacitor,
  SystemBars,
  SystemBarsStyle,
  SystemBarType,
} from "@capacitor/core";

/**
 * Nog twee keer toepassen, kort na het opstarten. Bij het wegklikken van het
 * native startscherm zet core-splashscreen (`Impl31.applyAppSystemUiTheme`) de
 * icoonstand van beide balken terug naar het native thema, en dat gebeurt ná
 * het eerste effect hieronder: SplashGate klikt het startscherm pas weg zodra de
 * UI staat. Gezien op een OnePlus 8 Pro: na een koude start in het lichte thema
 * witte iconen op een lichte strook. 800 ms dekt het wegklikken door SplashGate,
 * 2500 ms het plafond van `launchShowDuration` (2000 ms) in capacitor.config.ts.
 *
 * Vanaf build 7 staat `launchFadeOutDuration` op 0, dan registreert Capacitor de
 * listener niet en blijft de reset weg. Dit blijft nodig voor iedereen die nog
 * build 6 of ouder heeft.
 */
const REAPPLY_AFTER_MS = [800, 2500];

type Tone = "dark" | "light" | "system";

/**
 * Loopt de pagina onder deze balk door? De body draagt precies de safe-area-inset
 * als padding (globals.css), dus > 0 betekent dat de balk over onze inhoud ligt.
 */
function overlapsBar(side: "top" | "bottom"): boolean {
  const body = getComputedStyle(document.body);
  return parseFloat(side === "top" ? body.paddingTop : body.paddingBottom) > 0;
}

/**
 * Laat de iconen in de systeembalken (klok, wifi, batterij; navigatieknoppen of
 * gebarenbalk) het app-thema volgen.
 *
 * Sinds `viewport-fit=cover` (app/layout.tsx) staan die iconen op onze eigen
 * inhoud: de glazen strook bovenin, de onderbalk onderin. Die hebben de kleur van
 * het app-thema, en dat thema is een eigen keuze (cookie, standaard donker;
 * /login en /invite altijd licht) die niet gelijkloopt met de systeemmodus waar
 * Capacitor standaard op stuurt. Zonder deze sync gaf een telefoon in donkere
 * modus met de app in licht witte iconen op een witte strook.
 *
 * Alleen een balk waar de pagina écht onder loopt krijgt de themakleur; anders
 * `Default` (de systeemmodus). Op build 6 en ouder is de navigatiebalk op Android
 * 14 en lager een dichte balk in de systeemkleur, en iconen op het app-thema
 * gaven daar donkere knoppen op zwart.
 *
 * Let op de Capacitor-semantiek: `Dark` betekent "lichte iconen voor een donkere
 * ondergrond", dus donker thema → `Dark`.
 *
 * De statusbalk krijgt de stijl van beide plugins, SystemBars (core) én
 * @capacitor/status-bar: ze herstellen allebei hun eigen stijl bij een
 * configuratiewijziging (draaien, donkere modus aan/uit), in willekeurige
 * volgorde. Stond er in één van de twee nog DEFAULT, dan won af en toe alsnog de
 * systeemmodus.
 *
 * No-op op web. Faalt stil: een verkeerde iconkleur is geen reden om te crashen.
 */
export function SystemBarsSync() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const root = document.documentElement;
    const apply = () => {
      // Zelfde lezing als de thema-toggle: alles behalve "light" is donker.
      const themed: Tone = root.dataset.theme === "light" ? "light" : "dark";
      const status: Tone = overlapsBar("top") ? themed : "system";
      const nav: Tone = overlapsBar("bottom") ? themed : "system";
      const toSystemBars = {
        dark: SystemBarsStyle.Dark,
        light: SystemBarsStyle.Light,
        system: SystemBarsStyle.Default,
      };

      void SystemBars.setStyle({
        bar: SystemBarType.StatusBar,
        style: toSystemBars[status],
      }).catch(() => {});
      void SystemBars.setStyle({
        bar: SystemBarType.NavigationBar,
        style: toSystemBars[nav],
      }).catch(() => {});
      void import("@capacitor/status-bar")
        .then(({ StatusBar, Style }) =>
          StatusBar.setStyle({
            style: { dark: Style.Dark, light: Style.Light, system: Style.Default }[status],
          })
        )
        .catch(() => {});
    };

    apply();
    const timers = REAPPLY_AFTER_MS.map((ms) => window.setTimeout(apply, ms));
    // Terug uit de achtergrond: native kan intussen iets hebben teruggezet.
    const onVisible = () => {
      if (document.visibilityState === "visible") apply();
    };
    document.addEventListener("visibilitychange", onVisible);
    // De thema-toggle zet alleen `data-theme` om, zonder server-render.
    const observer = new MutationObserver(apply);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });

    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      document.removeEventListener("visibilitychange", onVisible);
      observer.disconnect();
    };
  }, []);

  return null;
}
