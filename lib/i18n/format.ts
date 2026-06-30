/**
 * Locale-bewuste datum-/getal-/valutaformattering op basis van `Intl`.
 *
 * Pure helpers (geen React/next-intl-context) zodat ze óók buiten een request
 * bruikbaar zijn — server-side e-mails, PDF's, scripts — door expliciet een
 * locale mee te geven. Binnen componenten kun je `useFormatter()`/`getFormatter()`
 * van next-intl gebruiken; deze helpers zijn de gedeelde, context-vrije variant.
 */

import { LOCALE_META, type AppLocale } from "@/lib/i18n/config";

function bcp47(locale: AppLocale): string {
  return LOCALE_META[locale].bcp47;
}

/** Datum → "30 jun 2026" (kort) of "30 juni 2026" (lang), per locale. */
export function formatDate(
  value: Date | number | string,
  locale: AppLocale,
  variant: "short" | "long" = "short",
): string {
  const date = value instanceof Date ? value : new Date(value);
  const options: Intl.DateTimeFormatOptions =
    variant === "long"
      ? { day: "numeric", month: "long", year: "numeric" }
      : { day: "numeric", month: "short", year: "numeric" };
  return new Intl.DateTimeFormat(bcp47(locale), options).format(date);
}

/** Tijd → "14:30", per locale. */
export function formatTime(value: Date | number | string, locale: AppLocale): string {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat(bcp47(locale), {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** Datum + tijd → "30 jun 2026, 14:30", per locale. */
export function formatDateTime(value: Date | number | string, locale: AppLocale): string {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat(bcp47(locale), {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** Getal met locale-scheidingstekens (bv. "1.234,5" NL vs "1,234.5" EN). */
export function formatNumber(
  value: number,
  locale: AppLocale,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(bcp47(locale), options).format(value);
}

/** Valuta (default EUR, voor toekomstige betaal-features). */
export function formatCurrency(
  value: number,
  locale: AppLocale,
  currency = "EUR",
): string {
  return new Intl.NumberFormat(bcp47(locale), {
    style: "currency",
    currency,
  }).format(value);
}
