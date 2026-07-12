import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor-wrapper voor de iOS-app (Play/Android loopt via TWA — zie twa/).
 *
 * De app is server-gerenderd (RSC), dus we bundelen 'm niet: we laden de gehoste
 * site via `server.url` (remote WKWebView). `webDir` bevat alleen een
 * fallback-laadscherm voor als de server onbereikbaar is.
 *
 * ⚠️ Deze remote-URL-aanpak is precies wat Apple's richtlijn 4.2 ("minimale
 * functionaliteit") streng beoordeelt — de native meerwaarde komt van de plugins
 * (haptics, camera via WebView, push/APNs, biometrie). Zie capacitor/README.md.
 *
 * Waarden zijn env-overschrijfbaar zodat dev/staging/prod naar de juiste host wijzen.
 */
const config: CapacitorConfig = {
  appId: process.env.CAPACITOR_APP_ID || "app.gymrebel.mobile",
  appName: "GymRebel",
  webDir: "capacitor/www",
  server: {
    url: process.env.CAPACITOR_SERVER_URL || "https://app.gymrebel.app",
    cleartext: false,
  },
  ios: {
    // Respecteer safe areas (notch/home-indicator); de web-UI gebruikt al
    // env(safe-area-inset-*).
    contentInset: "always",
  },
};

export default config;
