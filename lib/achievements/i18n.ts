import "server-only";
import { getLocale, getTranslations } from "next-intl/server";
import type { Locale as PrismaLocale } from "@prisma/client";
import { localeFromEnum, type AppLocale } from "@/lib/i18n/config";
import { formatNumber } from "@/lib/i18n/format";
import {
  unitKeyFor,
  type AchievementCategory,
  type AchievementDef,
} from "@/lib/achievements/definitions";

/**
 * Locale-bewuste resolver voor álle achievement-teksten (titels, omschrijvingen,
 * categorie-/rariteit-/level-labels en geformatteerde metricwaarden). Zonder
 * `recipient` volgt hij de UI-locale van de request; mét `recipient` (bv. een
 * notificatie naar een specifiek lid) forceert hij de taal van de ontvanger.
 *
 * De achievement-`key` (bv. "training.first") wordt naar een message-sleutel
 * gemapt door punten te vervangen door underscores ("training_first").
 */
export type AchievementTranslator = {
  locale: AppLocale;
  title: (key: string) => string;
  description: (key: string) => string;
  category: (c: AchievementCategory) => { label: string; description: string };
  rarity: (r: string) => string;
  level: (index: number) => string;
  /** Geformatteerde, vertaalde metricwaarde ("10 trainingen", "5 km", "3,5 uur"). */
  metric: (def: AchievementDef, value: number) => string;
};

const itemKey = (key: string): string => key.replace(/\./g, "_");

export async function getAchievementTranslator(
  recipient?: PrismaLocale | null,
): Promise<AchievementTranslator> {
  const locale: AppLocale = recipient
    ? localeFromEnum(recipient)
    : ((await getLocale()) as AppLocale);
  const t = await getTranslations({ locale, namespace: "achievements" });

  return {
    locale,
    title: (key) => t(`items.${itemKey(key)}.title`),
    description: (key) => t(`items.${itemKey(key)}.description`),
    category: (c) => ({
      label: t(`category.${c}.label`),
      description: t(`category.${c}.description`),
    }),
    rarity: (r) => t(`rarity.${r}`),
    level: (index) => t(`level.${index}`),
    metric: (def, value) => {
      if (def.displayKm) {
        return `${formatNumber(value / 1000, locale, { maximumFractionDigits: 1 })} ${t("unit.km")}`;
      }
      if (def.displayHours) {
        return `${formatNumber(value / 3600, locale, { maximumFractionDigits: 1 })} ${t("unit.uur")}`;
      }
      const rounded = Math.round(value);
      if (!def.unit) return String(rounded);
      return `${formatNumber(rounded, locale)} ${t(`unit.${unitKeyFor(def.unit)}`)}`;
    },
  };
}
