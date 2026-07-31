"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";

/**
 * Klikt het native startscherm weg zodra de web-app daadwerkelijk staat.
 *
 * De app laadt een remote URL, dus tussen het tekenen van de native activity en
 * het zichtbaar worden van de site zit netwerktijd. Zonder deze stap houdt
 * Capacitor het startscherm de volle `launchShowDuration` aan (2s, zie
 * capacitor.config.ts) óf verdwijnt het juist te vroeg en zie je een leeg vlak.
 *
 * Hier hebben we de enige betrouwbare informatie: als dit effect draait, heeft
 * React gehydrateerd en is er echte UI om naar te kijken.
 *
 * No-op op web (`isNativePlatform` is dan false), waar de browser z'n eigen
 * laadindicatie toont. Faalt stil: een startscherm dat blijft hangen door een
 * fout hier zou erger zijn dan een startscherm dat vanzelf na 2 seconden weggaat,
 * en die tijdslimiet staat los van deze aanroep.
 */
export function SplashGate() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let cancelled = false;

    // Eén frame wachten zodat de eerste paint gebeurd is; anders wisselen we naar
    // een WebView die technisch klaar maar visueel nog leeg is.
    const raf = requestAnimationFrame(() => {
      if (cancelled) return;
      void (async () => {
        try {
          const { SplashScreen } = await import("@capacitor/splash-screen");
          await SplashScreen.hide({ fadeOutDuration: 200 });
        } catch {
          /* stil — de plugin ontbreekt of het startscherm is al weg */
        }
      })();
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, []);

  return null;
}
