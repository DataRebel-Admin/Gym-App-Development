import { pushClientError } from "@/lib/report-client-errors";

/**
 * Diagnose van een mislukte WebAuthn-ceremonie, zónder de gebruiker het
 * technische detail te tonen. De browserfouten zijn betekenisvol
 * (SecurityError = rpID past niet bij het domein, InvalidStateError = sleutel
 * bestaat al, NotAllowedError = geannuleerd of geweigerd, NotReadableError =
 * de credential-manager van het toestel faalde) maar horen niet in de UI:
 * ze gaan naar de console én de client-error-ringbuffer, zodat ze automatisch
 * meekomen in de techcontext van "Probleem melden" (lib/report-context.ts).
 */
export function logWebAuthnError(source: string, err: unknown): void {
  const detail =
    err instanceof Error
      ? `${err.name || "Error"}${err.message ? `: ${err.message}` : ""}`
      : String(err);
  const message = `WebAuthn (${source}): ${detail}`.slice(0, 300);
  console.warn(message);
  pushClientError({ message, source, at: new Date().toISOString() });
}
