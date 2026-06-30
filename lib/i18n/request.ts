import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE } from "@/lib/constants";
import {
  DEFAULT_LOCALE,
  LOCALE_META,
  isLocale,
  pickFromAcceptLanguage,
  type AppLocale,
} from "@/lib/i18n/config";
import { loadMessages } from "@/lib/i18n/messages";

/**
 * next-intl request-config (cookie-modus, géén URL-routing).
 *
 * Bepaalt per request de actieve UI-locale en laadt de bijbehorende messages.
 * Resolutie-keten (eerste hit wint):
 *   1. `gymrebel-locale`-cookie (gezet door de switcher / login-sync)
 *   2. `Accept-Language`-header (nieuwe gast)
 *   3. NL (default)
 *
 * Bewust DB-vrij gehouden (geen User/Tenant-lookup hier) — die voorkeur wordt in
 * de cookie gesynchroniseerd bij login en bij wisselen. Houdt de request-config
 * licht, net als de edge-vriendelijke tenant-resolutie.
 */
async function resolveLocale(): Promise<AppLocale> {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;

  const headerStore = await headers();
  const fromHeader = pickFromAcceptLanguage(headerStore.get("accept-language"));
  if (fromHeader) return fromHeader;

  return DEFAULT_LOCALE;
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  return {
    locale,
    // Ontbrekende EN/FY-sleutels vallen via de deep-merge in `loadMessages`
    // automatisch terug op de NL-tekst ("tijdelijk Nederlandse tekst").
    messages: await loadMessages(locale),
    // Datums/getallen worden ge-formatteerd op de BCP-47-tag van de locale.
    // `now`/`timeZone` laten we aan next-intl/Intl over.
    onError(error) {
      // In development de ontbrekende-sleutel-waarschuwingen zichtbaar maken;
      // in productie stil (de merge dekt ze al af).
      if (process.env.NODE_ENV === "development") {
        console.warn(`[i18n] ${error.message}`);
      }
    },
    getMessageFallback({ namespace, key }) {
      return [namespace, key].filter(Boolean).join(".");
    },
    formats: {
      dateTime: {
        short: { day: "numeric", month: "short", year: "numeric" },
        long: { day: "numeric", month: "long", year: "numeric" },
      },
    },
  };
});

export { LOCALE_META };
