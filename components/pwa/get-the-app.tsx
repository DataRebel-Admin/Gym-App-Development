"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Capacitor } from "@capacitor/core";
import { buttonClasses } from "@/components/ui/button-classes";
import { GymRebelMark } from "@/components/brand/gymrebel-logo";
import { BRAND } from "@/components/brand/logo-art";

/**
 * "Haal de app"-blok voor de publieke landingspagina.
 *
 * Toont wat op dít toestel daadwerkelijk kan, in plaats van drie knoppen waarvan
 * er twee nergens heen gaan:
 *
 *  - **Android of desktop-Chrome** → een echte installatieknop, aangeboden via
 *    het `beforeinstallprompt`-event van de browser.
 *  - **iPhone of iPad in Safari** → dat event bestaat daar niet, dus de enige
 *    eerlijke optie is uitleggen waar "Zet op beginscherm" zit.
 *  - **Store-links** zodra `NEXT_PUBLIC_APP_STORE_URL` of
 *    `NEXT_PUBLIC_PLAY_STORE_URL` gevuld is. Zolang de apps niet gepubliceerd
 *    zijn blijven ze weg: een knop naar een niet-bestaande store-pagina is erger
 *    dan geen knop.
 *
 * Het blok verbergt zichzelf volledig wanneer het zinloos is: in de Capacitor-app
 * (je bént de app al) en in een reeds geïnstalleerde PWA.
 */

/** Het niet-gestandaardiseerde install-event van Chromium-browsers. */
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const APP_STORE_URL = process.env.NEXT_PUBLIC_APP_STORE_URL ?? "";
const PLAY_STORE_URL = process.env.NEXT_PUBLIC_PLAY_STORE_URL ?? "";

/**
 * Draait deze render op de client? Via `useSyncExternalStore` in plaats van een
 * `mounted`-vlag in een effect: de server-snapshot is `false`, dus de eerste
 * client-render is identiek aan de server-render en er is geen hydratatie-
 * verschil. Pas daarna mogen we `navigator` en `matchMedia` lezen.
 */
const subscribeNoop = () => () => {};
function useIsClient(): boolean {
  return useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  );
}

export function GetTheApp() {
  const isClient = useIsClient();
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;

    const onPrompt = (event: Event) => {
      // Voorkomt de eigen balk van de browser, zodat wij het moment kiezen.
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!installEvent) return;
    try {
      await installEvent.prompt();
      const { outcome } = await installEvent.userChoice;
      // Het event is eenmalig: na gebruik is het op, geaccepteerd of niet.
      setInstallEvent(null);
      if (outcome === "accepted") setInstalled(true);
    } catch {
      setInstallEvent(null);
    }
  }, [installEvent]);

  if (!isClient || Capacitor.isNativePlatform()) return null;

  // Pure toestel-eigenschappen; veilig tijdens een client-render te lezen.
  const ua = navigator.userAgent;
  // iPadOS meldt zich sinds versie 13 als Mac; het aanraakscherm verraadt 'm.
  const isIos =
    /iphone|ipod|ipad/i.test(ua) ||
    (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);

  // Draait dit al als geïnstalleerde app? Dan niets aanbieden. `standalone` op
  // navigator is de iOS-variant, de media query dekt de rest.
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return null;

  const canInstall = installEvent !== null;
  const hasStoreLinks = Boolean(APP_STORE_URL || PLAY_STORE_URL);

  // Niets te bieden: geen store-links, geen installatie-event en geen iOS-uitleg.
  // Dan liever helemaal geen blok dan een kop zonder inhoud.
  if (!hasStoreLinks && !canInstall && !isIos && !installed) return null;

  if (installed) {
    return (
      <section className="mt-10 flex w-full max-w-sm items-center gap-4 rounded-2xl border border-border bg-surface-1 p-5 text-left">
        <AppIcon />
        <div>
          <p className="font-display font-semibold text-neutral-900">Gelukt</p>
          <p className="mt-0.5 text-sm text-neutral-500">
            GymRebel staat nu op je beginscherm.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-10 w-full max-w-sm rounded-2xl border border-border bg-surface-1 p-5">
      <div className="flex items-center gap-4 text-left">
        <AppIcon />
        <div>
          <p className="font-display font-semibold leading-snug text-neutral-900">
            Download de GymRebel Training app
          </p>
          {/* Brand Book: "Your next workout is waiting". */}
          <p className="mt-0.5 text-sm text-neutral-500">
            Je volgende training staat klaar.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {canInstall ? (
          <button
            type="button"
            onClick={install}
            // Bewust `secondary` en niet de accent-knop: "Inloggen" staat er vlak
            // boven en is de primaire actie van deze pagina. Twee identieke
            // oranje knoppen onder elkaar laten de bezoeker kiezen tussen twee
            // dingen die er even belangrijk uitzien.
            className={buttonClasses({ variant: "secondary", className: "flex-1" })}
          >
            Nu installeren
          </button>
        ) : null}

        {isIos && !canInstall ? (
          <button
            type="button"
            onClick={() => setShowIosHint((v) => !v)}
            className={buttonClasses({ variant: "outline", className: "flex-1" })}
            aria-expanded={showIosHint}
          >
            Zo zet je &rsquo;m op je beginscherm
          </button>
        ) : null}

        {APP_STORE_URL ? (
          <a
            href={APP_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClasses({ variant: "outline", className: "flex-1" })}
          >
            App Store
          </a>
        ) : null}

        {PLAY_STORE_URL ? (
          <a
            href={PLAY_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClasses({ variant: "outline", className: "flex-1" })}
          >
            Google Play
          </a>
        ) : null}
      </div>

      {showIosHint ? (
        <p className="mt-3 text-left text-sm leading-relaxed text-neutral-500">
          Tik onderin op het deel-icoon, kies “Zet op beginscherm” en bevestig met
          “Voeg toe”. Daarna opent GymRebel als een gewone app, zonder adresbalk.
        </p>
      ) : null}
    </section>
  );
}

/**
 * Het app-icoon als voorproefje van wat er straks op het beginscherm staat:
 * zwart beeldmerk op Rebel Orange, zoals het Brand Book het onder "APP ICON"
 * toont en zoals `npm run brand:assets` het naar beide platforms schrijft.
 *
 * Inline opgebouwd uit `GymRebelMark` in plaats van het bestand uit
 * `public/brand/` te laden: scheelt een netwerkverzoek op de landingspagina, is
 * scherp op elk formaat en houdt het bij dezelfde vectorbron als de rest.
 */
function AppIcon() {
  return (
    <span
      aria-hidden
      // 22% hoekradius = de rx/size-verhouding van het gegenereerde app-icoon.
      className="grid size-14 shrink-0 place-items-center rounded-[22%] shadow-sm"
      style={{ backgroundColor: BRAND.orange }}
    >
      {/* 86% = dezelfde verhouding als `appIcon()` in de merkgenerator, zodat dit
          voorproefje klopt met wat er straks op het beginscherm staat. */}
      <GymRebelMark className="w-[86%] text-black" />
    </span>
  );
}
