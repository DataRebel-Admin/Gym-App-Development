"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { saveNotificationPrefs, type AccountFormState } from "../actions";

const CATEGORIES = [
  { key: "new_members", label: "Nieuwe leden" },
  { key: "invitations", label: "Uitnodigingen" },
  { key: "schemas", label: "Trainingsschema's" },
  { key: "achievements", label: "Trofeeën" },
  { key: "maintenance", label: "Onderhoud" },
  { key: "changes", label: "Wijzigingen" },
  { key: "system", label: "Systeemmeldingen" },
  { key: "news", label: "Nieuws" },
  { key: "security", label: "Beveiligingsmeldingen" },
] as const;

const CHANNELS = [
  { key: "email", label: "E-mail" },
  { key: "inApp", label: "In-app" },
  { key: "push", label: "Push" },
] as const;

type Channel = (typeof CHANNELS)[number]["key"];
type Prefs = Record<string, Record<Channel, boolean>>;

function defaults(): Prefs {
  const p: Prefs = {};
  for (const c of CATEGORIES) p[c.key] = { email: true, inApp: true, push: false };
  return p;
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
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
      <span
        className={cn(
          "inline-block size-5 transform rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-5" : "translate-x-0.5"
        )}
      />
    </button>
  );
}

export function NotificationsForm({ initial }: { initial: Prefs | null }) {
  const [prefs, setPrefs] = useState<Prefs>(() => {
    const base = defaults();
    if (initial && typeof initial === "object") {
      for (const c of CATEGORIES) {
        const row = initial[c.key];
        if (row) base[c.key] = { ...base[c.key], ...row };
      }
    }
    return base;
  });

  const [state, save, saving] = useActionState<AccountFormState, FormData>(
    saveNotificationPrefs,
    {}
  );
  const formRef = useRef<HTMLFormElement>(null);
  const [tick, setTick] = useState(0);

  const serialized = useMemo(() => JSON.stringify(prefs), [prefs]);

  useEffect(() => {
    if (tick === 0) return;
    const t = setTimeout(() => formRef.current?.requestSubmit(), 700);
    return () => clearTimeout(t);
  }, [tick]);

  function set(cat: string, channel: Channel, value: boolean) {
    setPrefs((p) => ({ ...p, [cat]: { ...p[cat], [channel]: value } }));
    setTick((t) => t + 1);
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-neutral-900">Meldingen</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Kies per categorie hoe je op de hoogte wilt blijven.
          </p>
        </div>
        <span className="text-xs text-neutral-400" aria-live="polite">
          {saving ? "Opslaan…" : state.ok ? "Opgeslagen ✓" : ""}
        </span>
      </header>

      <form ref={formRef} action={save}>
        <input type="hidden" name="prefs" value={serialized} />
        <div className="overflow-hidden rounded-2xl border border-border bg-surface-1">
          <div className="grid grid-cols-[1fr_repeat(3,72px)] items-center gap-2 border-b border-border px-4 py-3 text-xs font-medium uppercase tracking-wide text-neutral-400">
            <span>Categorie</span>
            {CHANNELS.map((ch) => (
              <span key={ch.key} className="text-center">{ch.label}</span>
            ))}
          </div>
          {CATEGORIES.map((cat) => (
            <div
              key={cat.key}
              className="grid grid-cols-[1fr_repeat(3,72px)] items-center gap-2 border-b border-neutral-100 px-4 py-3 last:border-0"
            >
              <span className="text-sm font-medium text-neutral-900">{cat.label}</span>
              {CHANNELS.map((ch) => (
                <span key={ch.key} className="flex justify-center">
                  <Toggle
                    checked={prefs[cat.key][ch.key]}
                    onChange={(v) => set(cat.key, ch.key, v)}
                    label={`${cat.label} – ${ch.label}`}
                  />
                </span>
              ))}
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-neutral-400">
          Pushmeldingen schakel je per apparaat in (zie hieronder).
        </p>
      </form>
    </div>
  );
}
