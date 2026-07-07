"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { AnimatePresence, m } from "motion/react";
import { cn } from "@/lib/cn";
import { Check, ChevronDown } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";
import { setLocale } from "@/lib/i18n/actions";
import { LocaleFlag } from "@/components/i18n/locale-flag";
import { LOCALES, LOCALE_META, isLocale, type AppLocale } from "@/lib/i18n/config";

/**
 * Taalwisselaar. Wisselen zet de cookie + (indien ingelogd) `User.locale` via de
 * `setLocale`-server-action en doet daarna `router.refresh()` → een directe
 * RSC-re-render: geen full reload, zelfde pagina, formulierdata behouden.
 *
 * - `variant="menu"`     → compacte rij voor in een dropdown/gebruikersmenu.
 * - `variant="dropdown"` → uitklapbare knop (toont de actieve taal, klapt de rest uit).
 * - `variant="settings"` → radio-kaarten met vlag + volledige naam (accountpagina).
 *
 * `direction` bepaalt of de dropdown-lijst naar beneden (standaard) of naar boven
 * opent — "up" voor een knop onderin een kaart (login-footer).
 */
export function LanguageSwitcher({
  variant = "menu",
  direction = "down",
}: {
  variant?: "menu" | "dropdown" | "settings";
  direction?: "up" | "down";
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

  if (variant === "dropdown") {
    return (
      <LanguageDropdown
        active={active}
        isPending={isPending}
        onChange={change}
        t={t}
        direction={direction}
      />
    );
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
              <LocaleFlag code={code} className="h-5 w-7" />
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-neutral-900">{meta.label}</span>
                <span className="block text-xs uppercase tracking-wide text-neutral-400">
                  {meta.code}
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
            <LocaleFlag code={code} />
            <span className="flex-1">{meta.label}</span>
            {selected ? <Check className="size-4" /> : null}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Uitklapbare taalkeuze: een knop toont de actieve taal; klikken vouwt de lijst
 * uit. Sluit bij klik-buiten en Escape.
 */
function LanguageDropdown({
  active,
  isPending,
  onChange,
  t,
  direction,
}: {
  active: string;
  isPending: boolean;
  onChange: (next: AppLocale) => void;
  t: ReturnType<typeof useTranslations>;
  direction: "up" | "down";
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const activeMeta = isLocale(active) ? LOCALE_META[active] : LOCALE_META.nl;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={isPending}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("switchLabel")}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-lg border border-border bg-surface-1 px-3 py-2 text-left text-sm text-neutral-700 transition-colors hover:bg-neutral-100 disabled:opacity-60",
          open && "bg-neutral-100",
        )}
      >
        <LocaleFlag code={isLocale(active) ? active : "nl"} />
        <span className="flex-1 font-medium">{activeMeta.label}</span>
        <ChevronDown
          className={cn("size-4 text-neutral-400 transition-transform", open && "rotate-180")}
        />
      </button>

      <AnimatePresence>
        {open ? (
          <m.ul
            role="listbox"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className={cn(
              "absolute left-0 z-10 w-full overflow-hidden rounded-lg border border-border bg-surface-1 p-0.5 shadow-lg",
              direction === "up" ? "bottom-full mb-1.5" : "top-full mt-1.5",
            )}
          >
            {LOCALES.map((code) => {
              const meta = LOCALE_META[code];
              const selected = isLocale(active) && active === code;
              return (
                <li key={code} role="option" aria-selected={selected}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(code);
                      setOpen(false);
                    }}
                    disabled={isPending}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors disabled:opacity-60",
                      selected
                        ? "font-medium text-accent"
                        : "text-neutral-700 hover:bg-neutral-100",
                    )}
                  >
                    <LocaleFlag code={code} />
                    <span className="flex-1">{meta.label}</span>
                    {selected ? <Check className="size-4" /> : null}
                  </button>
                </li>
              );
            })}
          </m.ul>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
