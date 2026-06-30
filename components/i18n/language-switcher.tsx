"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { m } from "motion/react";
import { cn } from "@/lib/cn";
import { Check } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";
import { setLocale } from "@/lib/i18n/actions";
import { LOCALES, LOCALE_META, isLocale, type AppLocale } from "@/lib/i18n/config";

/**
 * Taalwisselaar. Wisselen zet de cookie + (indien ingelogd) `User.locale` via de
 * `setLocale`-server-action en doet daarna `router.refresh()` → een directe
 * RSC-re-render: geen full reload, zelfde pagina, formulierdata behouden.
 *
 * - `variant="menu"`     → compacte rij voor in een dropdown/gebruikersmenu.
 * - `variant="settings"` → radio-kaarten met vlag + volledige naam (accountpagina).
 */
export function LanguageSwitcher({
  variant = "menu",
}: {
  variant?: "menu" | "settings";
}) {
  const router = useRouter();
  const active = useLocale();
  const t = useTranslations("account.language");
  const { success } = useToast();
  const [isPending, startTransition] = useTransition();

  function change(next: AppLocale) {
    if (next === active || isPending) return;
    startTransition(async () => {
      await setLocale(next);
      router.refresh();
      success(t("changed"));
    });
  }

  if (variant === "settings") {
    return (
      <div className="grid gap-2.5 sm:grid-cols-3">
        {LOCALES.map((code) => {
          const meta = LOCALE_META[code];
          const selected = isLocale(active) && active === code;
          return (
            <button
              key={code}
              type="button"
              onClick={() => change(code)}
              aria-pressed={selected}
              disabled={isPending}
              className={cn(
                "relative flex items-center gap-3 rounded-2xl border p-4 text-left transition-colors disabled:opacity-60",
                selected
                  ? "border-accent bg-accent-soft ring-1 ring-inset ring-accent/20"
                  : "border-border bg-surface-1 hover:bg-surface-2",
              )}
            >
              <span className="text-2xl leading-none" aria-hidden>
                {meta.flag}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-neutral-900">{meta.label}</span>
                <span className="block text-xs uppercase tracking-wide text-neutral-400">
                  {code}
                </span>
              </span>
              {selected ? (
                <m.span
                  layoutId="lang-active-settings"
                  className="flex size-5 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground"
                >
                  <Check className="size-3.5" />
                </m.span>
              ) : null}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div role="group" aria-label={t("switchLabel")} className="flex flex-col gap-0.5">
      {LOCALES.map((code) => {
        const meta = LOCALE_META[code];
        const selected = isLocale(active) && active === code;
        return (
          <button
            key={code}
            type="button"
            onClick={() => change(code)}
            disabled={isPending}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors disabled:opacity-60",
              selected
                ? "font-medium text-accent"
                : "text-neutral-700 hover:bg-neutral-100",
            )}
          >
            <span className="text-base leading-none" aria-hidden>
              {meta.flag}
            </span>
            <span className="flex-1">{meta.label}</span>
            {selected ? <Check className="size-4" /> : null}
          </button>
        );
      })}
    </div>
  );
}
