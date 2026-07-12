import type { MetadataRoute } from "next";

/**
 * PWA-manifest (`/manifest.webmanifest`). Next injecteert automatisch de
 * `<link rel="manifest">` op elke pagina.
 *
 * Bewust **whitelabel-neutraal en statisch**: één geïnstalleerde app = één
 * store-binary = één merk. De per-tenant huisstijl (naam, accent, logo) blijft
 * een runtime-laag ná login. De browser-themekleur kleurt wél per tenant mee —
 * zie `generateViewport` in `app/layout.tsx`.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GymRebel",
    short_name: "GymRebel",
    description: "Slimmer trainen in jouw sportschool.",
    lang: "nl",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#e84b1f",
    categories: ["health", "fitness", "sports"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
