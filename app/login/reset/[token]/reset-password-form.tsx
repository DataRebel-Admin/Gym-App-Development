"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { submitPasswordReset } from "../../actions";
import type { ResetResult } from "@/lib/password-reset";
import { checkPassword } from "@/lib/password-policy";
import { Field, Input } from "@/components/ui/field";
import { Button, buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export function ResetPasswordForm({ token }: { token: string }) {
  const t = useTranslations("auth.reset");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [state, action, pending] = useActionState<ResetResult | undefined, FormData>(
    submitPasswordReset,
    undefined
  );

  const check = checkPassword(password);
  const mismatch = confirm.length > 0 && confirm !== password;
  const canSubmit = check.allMet && !mismatch && confirm.length > 0;

  if (state?.ok) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-accent/12 text-accent">
          <svg viewBox="0 0 24 24" className="size-6" fill="none" aria-hidden>
            <path
              d="M5 12.5l4 4 10-10"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <p className="text-sm text-neutral-600">{t("successBody")}</p>
        <Link href="/login" className={buttonClasses({ size: "lg", className: "w-full" })}>
          {t("toLogin")}
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="flex w-full flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <Field
        label={t("newPasswordLabel")}
        error={state && !state.ok ? state.error : undefined}
      >
        <Input
          name="password"
          type="password"
          required
          autoComplete="new-password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="py-3 text-base"
        />
      </Field>

      {/* Live checklist — dezelfde regels als server-side (lib/password-policy). */}
      <ul className="flex flex-col gap-1.5">
        {check.requirements.map((r) => (
          <li key={r.id} className="flex items-center gap-2 text-xs">
            <span
              className={cn(
                "flex size-4 shrink-0 items-center justify-center rounded-full",
                r.met ? "bg-accent/15 text-accent" : "bg-neutral-100 text-neutral-300"
              )}
            >
              <svg viewBox="0 0 16 16" className="size-2.5" fill="none" aria-hidden>
                <path
                  d="M3.5 8.5l3 3 6-6.5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className={r.met ? "text-neutral-600" : "text-neutral-400"}>
              {r.label}
            </span>
          </li>
        ))}
      </ul>

      <Field
        label={t("confirmPasswordLabel")}
        error={mismatch ? t("mismatch") : undefined}
      >
        <Input
          name="confirm"
          type="password"
          required
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="py-3 text-base"
        />
      </Field>

      <Button
        type="submit"
        size="lg"
        loading={pending}
        disabled={!canSubmit}
        className="mt-1 w-full"
      >
        {pending ? t("saving") : t("save")}
      </Button>
    </form>
  );
}
