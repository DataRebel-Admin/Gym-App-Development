"use client";

import { useEffect, useRef, useState } from "react";
import { startAuthentication, browserSupportsWebAuthn } from "@simplewebauthn/browser";
import { startPasskeyLogin, finishPasskeyLogin } from "./passkey-actions";
import { useClientValue } from "@/lib/hooks/use-client-value";
import { isPasskeyDevice, markPasskeyDevice } from "@/lib/passkey-device";

/**
 * "Log in met toegangssleutel" — biometrische login (Face ID / Touch ID /
 * vingerafdruk) via WebAuthn. Usernameless: de browser toont de beschikbare
 * passkeys, de gekozen credential resolvet de gebruiker + sportschool server-side.
 * Verschijnt alleen als de browser WebAuthn ondersteunt.
 *
 * Heeft dit toestel eerder een passkey ingesteld of gebruikt (vlag in
 * localStorage, zie lib/passkey-device.ts), dan start de biometrische prompt
 * direct bij het openen van de pagina — inloggen zoals je je telefoon
 * ontgrendelt, zonder eerst een knop aan te tikken. Annuleren is geen fout:
 * het gewone formulier staat eronder en de knop blijft beschikbaar.
 */
export function PasskeyLoginButton() {
  const supported = useClientValue(browserSupportsWebAuthn, false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoTried = useRef(false);

  async function login(auto: boolean) {
    setError(null);
    setBusy(true);
    try {
      const options = await startPasskeyLogin();
      const response = await startAuthentication(options);
      // De ceremonie is op dit toestel gelukt → volgende keer direct starten.
      markPasskeyDevice();
      const res = await finishPasskeyLogin(response);
      // Succes → de server-action stuurt door (redirect); alleen fouten tonen we hier.
      if (res?.error) setError(res.error);
    } catch {
      // Meestal: de gebruiker annuleerde de biometrische prompt. Bij een
      // automatische poging is dat geen fout — het formulier staat eronder.
      if (!auto) setError("Inloggen met toegangssleutel geannuleerd of niet gelukt.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    // Auto-start éénmalig per paginabezoek (ref beschermt tegen de dubbele
    // effect-run van React StrictMode).
    if (!supported || autoTried.current || !isPasskeyDevice()) return;
    autoTried.current = true;
    void login(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported]);

  if (!supported) return null;

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => login(false)}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-border-strong bg-surface-1 px-4 py-3 text-sm font-semibold text-neutral-900 transition-colors hover:bg-neutral-100 focus-ring active:scale-[0.99] disabled:opacity-50"
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M12 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3z" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M6.5 20c0-3 2.5-5 5.5-5s5.5 2 5.5 5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {busy ? "Bezig…" : "Log in met toegangssleutel"}
      </button>
      {error ? <p className="text-center text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
