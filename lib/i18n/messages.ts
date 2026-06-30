import { DEFAULT_LOCALE, type AppLocale } from "@/lib/i18n/config";

/** Recursief samenvoegbaar message-object (next-intl `AbstractIntlMessages`). */
type MessageTree = { [key: string]: string | MessageTree };

/**
 * Diepe merge: `override` wint, ontbrekende takken komen uit `base`. Zo erven
 * EN/FY automatisch de NL-tekst voor sleutels die (nog) niet vertaald zijn —
 * er is nooit een harde missing key.
 */
function deepMerge(base: MessageTree, override: MessageTree): MessageTree {
  const out: MessageTree = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const existing = out[key];
    if (
      value &&
      typeof value === "object" &&
      existing &&
      typeof existing === "object"
    ) {
      out[key] = deepMerge(existing, value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

/** Lazy import van één locale-bundel (alleen de actieve taal wordt geladen). */
async function importLocale(locale: AppLocale): Promise<MessageTree> {
  switch (locale) {
    case "en":
      return (await import("@/messages/en.json")).default as MessageTree;
    case "fy":
      return (await import("@/messages/fy.json")).default as MessageTree;
    case "nl":
    default:
      return (await import("@/messages/nl.json")).default as MessageTree;
  }
}

/**
 * Laadt de messages voor `locale`, met NL als basis zodat onvertaalde sleutels
 * terugvallen op het Nederlands. Voor NL zelf is er niets te mergen.
 */
export async function loadMessages(locale: AppLocale): Promise<MessageTree> {
  const base = await importLocale(DEFAULT_LOCALE);
  if (locale === DEFAULT_LOCALE) return base;
  const override = await importLocale(locale);
  return deepMerge(base, override);
}
