import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Schakelt `forbidden()` / `unauthorized()` (next/navigation) in zodat de
    // guards naar de premium 403/401-pagina's kunnen onderbreken i.p.v. te
    // redirecten. Rendert app/forbidden.tsx resp. app/unauthorized.tsx.
    authInterrupts: true,
  },
};

export default nextConfig;
