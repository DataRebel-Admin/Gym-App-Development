"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { MemberSchemaMode } from "@prisma/client";
import { setMemberSchemaMode } from "@/app/owner/settings/actions";

const MODES: MemberSchemaMode[] = ["DISABLED", "APPROVAL", "DIRECT"];

/**
 * Keuze van de controle-modus voor zelf-gebouwde lid-schema's. Radio-kaarten +
 * één opslagknop (server-action). Bewust simpel — één instelling per tenant.
 */
export function MemberSchemaModeForm({ current }: { current: MemberSchemaMode }) {
  const t = useTranslations("owner.settings");
  const [mode, setMode] = useState<MemberSchemaMode>(current);

  return (
    <form action={setMemberSchemaMode} className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        {MODES.map((m) => (
          <label
            key={m}
            className={`flex cursor-pointer flex-col gap-0.5 rounded-lg border px-4 py-3 text-sm transition-colors ${
              mode === m
                ? "border-accent bg-accent-soft"
                : "border-neutral-200 hover:bg-neutral-50"
            }`}
          >
            <span className="flex items-center gap-2 font-medium text-neutral-900">
              <input
                type="radio"
                name="mode"
                value={m}
                checked={mode === m}
                onChange={() => setMode(m)}
                className="accent-[var(--tenant-accent)]"
              />
              {t(`memberSchemaMode${m}`)}
            </span>
            <span className="pl-6 text-neutral-500">{t(`memberSchemaHint${m}`)}</span>
          </label>
        ))}
      </div>
      <button
        type="submit"
        disabled={mode === current}
        className="self-start rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50"
      >
        {t("memberSchemaSave")}
      </button>
    </form>
  );
}
