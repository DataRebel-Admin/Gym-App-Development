import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// next-intl in "without i18n routing"-modus: locale komt uit een cookie
// (zie lib/i18n/request.ts), niet uit de URL. Géén next-intl-middleware nodig;
// de bestaande proxy.ts blijft ongewijzigd.
const withNextIntl = createNextIntlPlugin("./lib/i18n/request.ts");

const nextConfig: NextConfig = {
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
