import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor-wrapper voor **iOS én Android** (App Store + Play Store).
 *
 * ## Waarom een remote `server.url` en géén gebundelde build
 *
 * GymRebel is een Next.js App Router-app met React Server Components, Server
 * Actions, Auth.js-sessies en Prisma/PostgreSQL. Al die rendering gebeurt op de
 * server; er bestaat dus geen statische `out/`-map om in de app te bundelen
 * (`output: "export"` is onverenigbaar met server actions, de proxy/middleware
 * en dynamische routes). De WebView laadt daarom de gehoste productie-site.
 *
 * Consequenties, bewust geaccepteerd:
 *  - **Web-wijzigingen zijn direct live** zonder store-review. Alleen native
 *    wijzigingen (plugins, permissies, iconen) vergen een nieuwe build.
 *  - **Zonder netwerk werkt de app niet.** Gemitigeerd met `errorPath` hieronder:
 *    bij een laadfout toont de WebView een lokale, gebrande foutpagina in plaats
 *    van de kale systeemfout van de WebView.
 *  - Capacitor documenteert `server.url` als bedoeld voor live-reload en "not
 *    intended for use in production". Functioneel werkt het prima en veel
 *    productie-apps doen dit, maar je zit daarmee buiten het gebaande pad.
 *  - **Apple-richtlijn 4.2 (minimale functionaliteit)** beoordeelt een app die
 *    enkel een website toont streng. De native meerwaarde zit hier in haptics
 *    (Taptic Engine), camera-QR-scan, APNs-push en biometrische login/passkeys.
 *    Zie `capacitor/README.md` voor de argumentatie richting review.
 *
 * Het alternatief is een herbouw naar een client-side SPA met losse API. Dat is
 * een projectherziening, geen publicatiestap, en valt buiten scope.
 *
 * Waarden zijn env-overschrijfbaar zodat dev, staging en productie naar de
 * juiste host wijzen zonder codewijziging.
 */
const config: CapacitorConfig = {
  // Bundle ID (iOS) / package name (Android). Identiek op beide platforms.
  // ⚠️ ONVERANDERLIJK na de eerste store-publicatie: wijzigen betekent een
  // nieuwe listing zonder reviews, downloads of installaties. Afgeleid van het
  // websitedomein gymrebel-training.nl; het koppelteken kan niet mee omdat een
  // Android-package-name alleen letters, cijfers en underscores toestaat.
  appId: process.env.CAPACITOR_APP_ID || "nl.gymrebeltraining.app",
  // Naam onder het app-icoon. Bewust kort: iOS kapt rond de 12 tekens af.
  appName: "GymRebel",
  webDir: "capacitor/www",
  // Achtergrond van de WebView vóór de eerste paint; voorkomt een witte flits
  // tegen de donkere huisstijl in. Gelijk aan Charcoal uit het Brand Book.
  backgroundColor: "#111111",
  server: {
    url: process.env.CAPACITOR_SERVER_URL || "https://app.gymrebel-training.nl",
    // Geen onversleuteld HTTP, ook niet in dev-builds naar een LAN-adres.
    cleartext: false,
    // Lokale fallbackpagina bij een laadfout (server plat, geen netwerk, DNS).
    // Staat in `webDir`, dus altijd beschikbaar zonder verbinding.
    errorPath: "error.html",
  },
  ios: {
    // Respecteer safe areas (notch, Dynamic Island, home-indicator); de web-UI
    // gebruikt al env(safe-area-inset-*).
    contentInset: "always",
    // WKAppBoundDomains + deze vlag zijn nodig om service workers en WebAuthn
    // *binnen* een WKWebView te laten werken. Bewust UIT, omdat het navigatie
    // beperkt tot maximaal 10 vastgelegde domeinen en dat de YouTube/Vimeo-
    // embeds bij oefeningvideo's breekt (lib/video.ts). Passkeys lopen op iOS
    // via de native Associated Domains-koppeling (AASA-route), niet via de
    // WebView, dus die blijven werken. Zet dit alleen aan als je de embeds laat
    // vallen; pas dan óók WKAppBoundDomains in Info.plist aan.
    limitsNavigationsToAppBoundDomains: false,
  },
  android: {
    // Alleen HTTPS-content in de WebView; geen mixed content.
    allowMixedContent: false,
    // Chrome DevTools-inspectie uit in release-builds. Play markeert een
    // debugbare WebView als beveiligingsrisico.
    webContentsDebuggingEnabled: false,
  },
};

export default config;
