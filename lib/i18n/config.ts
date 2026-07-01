/**
 * Centrale talen-registry voor de i18n-architectuur (next-intl, cookie-modus).
 *
 * Bron van waarheid — net als `audit-actions`/`exercise-types`: **een nieuwe taal
 * toevoegen = één regel in `LOCALES` + één record in `LOCALE_META`** (+ een
 * `messages/<code>/`-map; ontbrekende sleutels vallen automatisch terug op NL).
 *
 * Géén `server-only`: deze module wordt zowel server- als client-side gebruikt
 * (switcher, `<html lang>`, formattering). Bevat geen DB-/header-toegang.
 */

import type { Locale as PrismaLocale } from "@prisma/client";

/** Ondersteunde UI-talen (routing-codes, lowercase). NL = standaard/bron. */
export const LOCALES = ["nl", "en", "fy"] as const;

export type AppLocale = (typeof LOCALES)[number];

/** Default-taal wanneer niets bekend is (cookie noch browservoorkeur). */
export const DEFAULT_LOCALE: AppLocale = "nl";

type LocaleMeta = {
  /** Volledige taalnaam in de eigen taal (voor de switcher). */
  label: string;
  /** Vlag-emoji (optioneel decoratief; op sommige OS'en rendert dit als
   *  láttercode — de UI gebruikt daarom `<LocaleFlag>` met echte SVG's). */
  flag: string;
  /** Korte afkorting op taalkaarten (bv. "NL", "EN", "FRL"). Bewust géén
   *  1-op-1 uppercase van de routing-code: Frysk = "FRL" (niet "FY"). */
  code: string;
  /** BCP-47 tag voor `<html lang>` en `Intl`-formattering. */
  bcp47: string;
  /** Bijbehorende Prisma `Locale`-enumwaarde (DB). */
  enum: PrismaLocale;
};

/** Metadata per taal — gebruikt door switcher, root-layout en formattering. */
export const LOCALE_META: Record<AppLocale, LocaleMeta> = {
  nl: { label: "Nederlands", flag: "🇳🇱", code: "NL", bcp47: "nl-NL", enum: "NL" },
  en: { label: "English", flag: "🇬🇧", code: "EN", bcp47: "en-GB", enum: "EN" },
  fy: { label: "Frysk", flag: "🇳🇱", code: "FRL", bcp47: "fy-NL", enum: "FY" },
};

/** Type-guard: is `value` een ondersteunde locale-code? */
export function isLocale(value: unknown): value is AppLocale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Prisma `Locale`-enum (NL/EN/FY) → routing-code (nl/en/fy). */
export function localeFromEnum(value: PrismaLocale | null | undefined): AppLocale {
  switch (value) {
    case "EN":
      return "en";
    case "FY":
      return "fy";
    case "NL":
      return "nl";
    default:
      return DEFAULT_LOCALE;
  }
}

/** Routing-code (nl/en/fy) → Prisma `Locale`-enum (NL/EN/FY). */
export function enumFromLocale(locale: AppLocale): PrismaLocale {
  return LOCALE_META[locale].enum;
}

/**
 * Kiest de best passende ondersteunde taal uit een `Accept-Language`-header.
 * Respecteert q-waarden en matcht op de primaire taal-subtag (bv. `en-US` → `en`).
 * Geen match → `null` (caller valt dan terug op de default).
 */
export function pickFromAcceptLanguage(header: string | null | undefined): AppLocale | null {
  if (!header) return null;
  const ranked = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const qParam = params.find((p) => p.trim().startsWith("q="));
      const q = qParam ? Number.parseFloat(qParam.split("=")[1]) : 1;
      return { tag: tag.toLowerCase(), q: Number.isFinite(q) ? q : 1 };
    })
    .filter((entry) => entry.tag.length > 0)
    .sort((a, b) => b.q - a.q);

  for (const { tag } of ranked) {
    const primary = tag.split("-")[0];
    if (isLocale(primary)) return primary;
  }
  return null;
}
