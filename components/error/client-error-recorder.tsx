"use client";

import { useEffect } from "react";
import { pushClientError } from "@/lib/report-client-errors";

// Rendert niets; vult alleen de ringbuffer (lib/report-client-errors.ts) met
// de laatste client-side errors zodat een probleem-melding ze automatisch kan
// meesturen. Gemount in app/layout.tsx (naast ServiceWorkerRegister) → dekt
// álle pagina's, ook vóór er ooit een meldformulier opent.
export function ClientErrorRecorder() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      pushClientError({
        message: event.message || "Onbekende fout",
        source: event.filename ? `${event.filename}:${event.lineno ?? 0}` : undefined,
        stack: event.error instanceof Error ? event.error.stack : undefined,
        at: new Date().toISOString(),
      });
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason: unknown = event.reason;
      pushClientError({
        message:
          reason instanceof Error
            ? reason.message
            : typeof reason === "string"
              ? reason
              : "Unhandled promise rejection",
        source: "unhandledrejection",
        stack: reason instanceof Error ? reason.stack : undefined,
        at: new Date().toISOString(),
      });
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
