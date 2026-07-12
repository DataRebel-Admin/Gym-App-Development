"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { requestPasswordResetAction } from "../actions";
import type { LoginState } from "@/lib/login-types";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export function ResetRequestForm() {
  const t = useTranslations("auth.reset");
  const [state, action, pending] = useActionState<LoginState, FormData>(
    requestPasswordResetAction,
    {}
  );

  return (
    <form action={action} className="flex w-full flex-col gap-4">
      <Field label={t("emailLabel")} error={state.error}>
        <Input
          name="email"
          type="email"
          required
          autoComplete="email"
          autoFocus
          placeholder={t("emailPlaceholder")}
          className="py-3 text-base"
        />
      </Field>
      <Button type="submit" size="lg" loading={pending} className="mt-1 w-full">
        {pending ? t("sending") : t("sendLink")}
      </Button>
    </form>
  );
}
