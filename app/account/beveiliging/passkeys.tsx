"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startRegistration, browserSupportsWebAuthn } from "@simplewebauthn/browser";
import {
  startPasskeyRegistration,
  finishPasskeyRegistration,
  removePasskey,
} from "../passkey-actions";
import { buttonClasses } from "@/components/ui/button-classes";
import { cn } from "@/lib/cn";
import { useClientValue } from "@/lib/hooks/use-client-value";
import { markPasskeyDevice } from "@/lib/passkey-device";
import { webAuthnErrorDetail } from "@/lib/webauthn-error";

export type PasskeyRow = {
  id: string;
  name: string | null;
  createdAt: string;
  lastUsedAt: string | null;
};

const DT = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short", year: "numeric" });

export function Passkeys({ passkeys }: { passkeys: PasskeyRow[] }) {
  const router = useRouter();
  const supported = useClientValue(browserSupportsWebAuthn, true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function add() {
    setError(null);
    setBusy(true);
    try {
      const options = await startPasskeyRegistration();
      const response = await startRegistration(options);
      const suggested =
        typeof navigator !== "undefined" && navigator.platform ? navigator.platform : undefined;
      const res = await finishPasskeyRegistration({ response, name: suggested });
      if (!res.ok) setError(res.error);
      else {
        // Volgende bezoek aan de inlogpagina start de biometrische login direct.
        markPasskeyDevice();
        router.refresh();
      }
    } catch (err) {
      // Kan annuleren zijn, maar toon het technische detail erbij: zonder dat
      // is een échte fout (rpID/koppeling/al-geregistreerd) niet te herleiden.
      setError(`Registratie geannuleerd of niet gelukt. (${webAuthnErrorDetail(err)})`);
    } finally {
      setBusy(false);
    }
  }

  function remove(id: string) {
    if (!window.confirm("Deze toegangssleutel verwijderen? Je kunt er daarna niet meer mee inloggen.")) {
      return;
    }
    startTransition(async () => {
      await removePasskey(id);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {passkeys.length === 0 ? (
        <p className="text-sm text-neutral-500">
          Nog geen toegangssleutels. Voeg er één toe om voortaan met Face ID, Touch ID of je
          vingerafdruk in te loggen.
        </p>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {passkeys.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-neutral-900">
                  {p.name || "Toegangssleutel"}
                </p>
                <p className="text-xs text-neutral-400">
                  Toegevoegd {DT.format(new Date(p.createdAt))}
                  {p.lastUsedAt ? ` · laatst gebruikt ${DT.format(new Date(p.lastUsedAt))}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => remove(p.id)}
                disabled={pending}
                className="inline-flex h-10 shrink-0 items-center rounded-xl border border-border px-4 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 disabled:opacity-50"
              >
                Verwijderen
              </button>
            </li>
          ))}
        </ul>
      )}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div>
        <button
          type="button"
          onClick={add}
          disabled={!supported || busy}
          className={cn(buttonClasses({ variant: "primary" }), "w-full disabled:opacity-50 sm:w-auto")}
        >
          {busy ? "Bezig…" : "Toegangssleutel toevoegen"}
        </button>
        {!supported ? (
          <p className="mt-2 text-xs text-neutral-400">
            Dit apparaat of deze browser ondersteunt geen toegangssleutels.
          </p>
        ) : null}
      </div>
    </div>
  );
}
