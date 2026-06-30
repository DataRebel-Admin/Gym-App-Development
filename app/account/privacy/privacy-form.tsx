"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { saveConsents, type AccountFormState } from "../actions";

const CONSENTS = [
  { key: "product_updates", label: "Productupdates", hint: "Nieuwe functies en verbeteringen." },
  { key: "marketing", label: "Marketing-e-mails", hint: "Aanbiedingen en nieuwsbrieven." },
  { key: "usage_analytics", label: "Gebruiksanalyse", hint: "Anonieme statistieken om de app te verbeteren." },
] as const;

type Consents = Record<string, boolean>;

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-ring",
        checked ? "bg-accent" : "bg-neutral-300"
      )}
    >
      <span className={cn("inline-block size-5 transform rounded-full bg-white shadow transition-transform", checked ? "translate-x-5" : "translate-x-0.5")} />
    </button>
  );
}

export function ConsentsForm({ initial }: { initial: Consents | null }) {
  const [consents, setConsents] = useState<Consents>(() => {
    const base: Consents = {};
    for (const c of CONSENTS) base[c.key] = initial?.[c.key] ?? false;
    return base;
  });
  const [state, save, saving] = useActionState<AccountFormState, FormData>(saveConsents, {});
  const formRef = useRef<HTMLFormElement>(null);
  const [tick, setTick] = useState(0);
  const serialized = useMemo(() => JSON.stringify(consents), [consents]);

  useEffect(() => {
    if (tick === 0) return;
    const t = setTimeout(() => formRef.current?.requestSubmit(), 600);
    return () => clearTimeout(t);
  }, [tick]);

  function set(key: string, v: boolean) {
    setConsents((c) => ({ ...c, [key]: v }));
    setTick((t) => t + 1);
  }

  return (
    <form ref={formRef} action={save} className="flex flex-col gap-1">
      <input type="hidden" name="consents" value={serialized} />
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-900">Toestemmingen</h2>
        <span className="text-xs text-neutral-400" aria-live="polite">
          {saving ? "Opslaan…" : state.ok ? "Opgeslagen ✓" : ""}
        </span>
      </div>
      <div className="mt-2 divide-y divide-neutral-100">
        {CONSENTS.map((c) => (
          <div key={c.key} className="flex items-center justify-between gap-4 py-3">
            <div>
              <p className="text-sm font-medium text-neutral-900">{c.label}</p>
              <p className="text-xs text-neutral-500">{c.hint}</p>
            </div>
            <Toggle checked={consents[c.key]} onChange={(v) => set(c.key, v)} label={c.label} />
          </div>
        ))}
      </div>
    </form>
  );
}
