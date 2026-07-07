"use client";

import { useActionState, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  updateOutgoingEmail,
  type OutgoingEmailState,
} from "@/app/admin/settings/actions";

/**
 * Superadmin-schakelaar: alle uitgaande transactionele e-mail platform-breed
 * aan/uit. Uit = er gaat geen echte mail de deur uit (wel gelogd in de console).
 */
export function OutgoingEmailToggle({ enabled }: { enabled: boolean }) {
  const [state, formAction, pending] = useActionState<OutgoingEmailState, FormData>(
    updateOutgoingEmail,
    {}
  );

  // Optimistische lokale weergave; server bevestigt de nieuwe stand.
  const [on, setOn] = useState(enabled);
  useEffect(() => {
    if (state.ok && typeof state.enabled === "boolean") setOn(state.enabled);
  }, [state.ok, state.enabled]);

  const target = !on;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-neutral-900">
            Uitgaande e-mail
          </span>
          <Badge tone={on ? "success" : "neutral"}>{on ? "Aan" : "Uit"}</Badge>
        </div>
        <p className="mt-1 text-sm text-neutral-500">
          {on
            ? "Transactionele e-mails (uitnodigingen, magic links, schema-meldingen …) worden echt verstuurd."
            : "Alle uitgaande e-mail staat uit. Berichten worden alleen naar de server-console gelogd, niet verzonden."}
        </p>
        {state.error ? (
          <p className="mt-2 text-xs text-red-600">{state.error}</p>
        ) : null}
      </div>

      <form action={formAction} className="shrink-0 sm:pt-1">
        <input type="hidden" name="enabled" value={target ? "on" : "off"} />
        <button
          type="submit"
          role="switch"
          aria-checked={on}
          aria-label={on ? "Uitgaande e-mail uitschakelen" : "Uitgaande e-mail inschakelen"}
          disabled={pending}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${
            on ? "bg-accent" : "bg-neutral-300"
          }`}
        >
          <span
            className={`inline-block size-5 rounded-full bg-white shadow transition-transform ${
              on ? "translate-x-[22px]" : "translate-x-0.5"
            }`}
          />
        </button>
      </form>
    </div>
  );
}
