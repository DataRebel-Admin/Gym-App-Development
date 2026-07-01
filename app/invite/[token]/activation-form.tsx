"use client";

import { useActionState, useMemo, useState } from "react";
import {
  activateAccount,
  requestNewActivationLink,
  type ActivationState,
} from "./actions";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { checkPassword } from "@/lib/password-policy";
import { passwordStrength } from "@/lib/password-strength";
import { cn } from "@/lib/cn";

const STRENGTH_COLORS = [
  "bg-red-500",
  "bg-orange-500",
  "bg-amber-500",
  "bg-lime-500",
  "bg-emerald-500",
];

export function ActivationForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState<ActivationState, FormData>(
    activateAccount,
    {}
  );
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);

  const check = useMemo(() => checkPassword(password), [password]);
  const strength = useMemo(() => passwordStrength(password), [password]);
  const mismatch = confirm.length > 0 && confirm !== password;
  const canSubmit = check.allMet && password === confirm && confirm.length > 0;

  return (
    <form action={formAction} className="flex w-full flex-col gap-4">
      <input type="hidden" name="token" value={token} />

      <Field label="Kies een wachtwoord">
        <div className="relative">
          <Input
            name="password"
            type={show ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            autoFocus
            className="py-3 pr-11 text-base"
            placeholder="Minimaal 12 tekens"
          />
          <ShowToggle show={show} onToggle={() => setShow((s) => !s)} />
        </div>
      </Field>

      {/* Sterkte-indicator */}
      <div className="-mt-1 flex flex-col gap-1.5" aria-hidden={password.length === 0}>
        <div className="flex gap-1">
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                password && i <= strength.score
                  ? STRENGTH_COLORS[strength.score]
                  : "bg-neutral-200"
              )}
            />
          ))}
        </div>
        {password ? (
          <span className="text-xs font-medium text-neutral-500">
            Sterkte: {strength.label}
          </span>
        ) : null}
      </div>

      {/* Realtime eisen-checklist */}
      <ul className="flex flex-col gap-1.5 rounded-xl bg-neutral-50 p-3">
        {check.requirements.map((r) => (
          <li
            key={r.id}
            className={cn(
              "flex items-center gap-2 text-xs transition-colors",
              r.met ? "text-emerald-600" : "text-neutral-500"
            )}
          >
            {r.met ? <CheckIcon /> : <DotIcon />}
            {r.label}
          </li>
        ))}
      </ul>

      <Field
        label="Bevestig wachtwoord"
        error={mismatch ? "De wachtwoorden komen niet overeen" : state.error}
      >
        <div className="relative">
          <Input
            name="confirm"
            type={show ? "text" : "password"}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            autoComplete="new-password"
            className="py-3 pr-11 text-base"
            placeholder="Herhaal je wachtwoord"
          />
          <ShowToggle show={show} onToggle={() => setShow((s) => !s)} />
        </div>
      </Field>

      <Button
        type="submit"
        size="lg"
        loading={pending}
        disabled={!canSubmit || pending}
        className="mt-1 w-full"
      >
        {pending ? "Account activeren…" : "Account activeren"}
      </Button>

      <p className="text-center text-xs text-neutral-500">
        Hierna kun je inloggen met je wachtwoord of via een magic link.
      </p>
    </form>
  );
}

/** Verlopen-link: vraag een nieuwe activatiemail aan (gaat naar het uitgenodigde adres). */
export function ResendForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState<ActivationState, FormData>(
    requestNewActivationLink,
    {}
  );
  return (
    <form action={formAction} className="flex w-full flex-col gap-3">
      <input type="hidden" name="token" value={token} />
      <Button type="submit" size="lg" loading={pending} className="w-full">
        {pending ? "Versturen…" : "Nieuwe activatielink aanvragen"}
      </Button>
      {state.error ? (
        <p className="text-center text-xs text-red-600">{state.error}</p>
      ) : null}
    </form>
  );
}

function ShowToggle({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={show ? "Wachtwoord verbergen" : "Wachtwoord tonen"}
      className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-neutral-400 transition-colors hover:text-neutral-600 focus-ring"
    >
      {show ? <EyeOffIcon /> : <EyeIcon />}
    </button>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5 shrink-0" fill="none" aria-hidden>
      <path d="M3.5 8.5l3 3 6-6.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DotIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5 shrink-0" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="2.5" fill="currentColor" opacity="0.4" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 20 20" className="size-4" fill="none" aria-hidden>
      <path d="M1.5 10S4.5 4.5 10 4.5 18.5 10 18.5 10 15.5 15.5 10 15.5 1.5 10 1.5 10z" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 20 20" className="size-4" fill="none" aria-hidden>
      <path d="M8 4.7A7.6 7.6 0 0 1 10 4.5c5.5 0 8.5 5.5 8.5 5.5a15 15 0 0 1-2.2 2.9M4.2 5.9A15 15 0 0 0 1.5 10S4.5 15.5 10 15.5c1 0 1.9-.2 2.7-.5M3 3l14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
