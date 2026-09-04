/**
 * Leesbaar detail bij een mislukte WebAuthn-ceremonie (client-side). De
 * browserfouten zijn betekenisvol (SecurityError = rpID past niet bij het
 * domein, InvalidStateError = sleutel bestaat al, NotAllowedError = geannuleerd
 * of geweigerd door het systeem) maar verdwenen eerder in één generieke
 * melding, waardoor een mislukte registratie niet te herleiden was.
 */
export function webAuthnErrorDetail(err: unknown): string {
  if (err instanceof Error) {
    const name = err.name || "Error";
    const msg = err.message ? `: ${err.message}` : "";
    return `${name}${msg}`.slice(0, 300);
  }
  return String(err).slice(0, 300);
}
