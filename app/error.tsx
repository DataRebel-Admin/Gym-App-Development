"use client";

import { useEffect } from "react";
import { ErrorLayout } from "@/components/error/error-layout";
import { buildErrorNav } from "@/lib/errors";

/**
 * Premium 500 — error-boundary voor onverwachte runtime-fouten binnen de
 * root-layout. Client component (Next-vereiste) met een `reset`-handler die de
 * "Probeer opnieuw"-knop voedt. Tenant-branding komt uit `useTenant()` in de
 * ErrorLayout; sessie is hier niet beschikbaar (client) → navigatie valt terug
 * op home/login.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Server-side al gelogd; hier alleen voor zichtbaarheid in de dev-console.
    console.error(error);
  }, [error]);

  return <ErrorLayout code={500} nav={buildErrorNav(null)} reset={reset} />;
}
