import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// next-intl in "without i18n routing"-modus: locale komt uit een cookie
// (zie lib/i18n/request.ts), niet uit de URL. Géén next-intl-middleware nodig;
// de bestaande proxy.ts blijft ongewijzigd.
const withNextIntl = createNextIntlPlugin("./lib/i18n/request.ts");

const nextConfig: NextConfig = {
  // Native/HTTP2-packages niet bundelen, als extern server-package laden.
  // @resvg/resvg-js = QR-rasterisatie (native addon); apns2 = APNs-push (undici/HTTP2).
  serverExternalPackages: ["@resvg/resvg-js", "apns2"],
  images: {
    // AVIF/WebP-varianten (met bron-fallback) → fors kleinere afbeeldingen op mobiel.
    formats: ["image/avif", "image/webp"],
    // Toegestane remote bronnen voor next/image. `datarebel.blob.core.windows.net` =
    // de oefeningen-catalogus (statische .jpg-thumbnails); Vercel Blob = door tenants
    // geüploade eigen-oefening-afbeeldingen. Animatie-gifs (detail/actieve sessie)
    // blijven bewust rauwe <img> — die optimaliseren we niet (zou animatie strippen).
    remotePatterns: [
      { protocol: "https", hostname: "datarebel.blob.core.windows.net" },
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
    ],
  },
  experimental: {
    // Schakelt `forbidden()` / `unauthorized()` (next/navigation) in zodat de
    // guards naar de premium 403/401-pagina's kunnen onderbreken i.p.v. te
    // redirecten. Rendert app/forbidden.tsx resp. app/unauthorized.tsx.
    authInterrupts: true,
    // Barrel-tree-shaking: importeert alleen de daadwerkelijk gebruikte modules
    // uit deze packages i.p.v. de hele barrel → kleinere client-bundles en
    // snellere cold starts. Puur een build-optimalisatie, geen gedragswijziging.
    optimizePackageImports: ["lucide-react", "recharts", "motion", "react-markdown"],
  },
};

export default withNextIntl(nextConfig);
