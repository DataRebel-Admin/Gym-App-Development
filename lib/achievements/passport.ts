import "server-only";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import {
  Calendar,
  Flame,
  Dumbbell,
  type LucideIcon,
} from "@/components/ui/icons";
import { ACHIEVEMENTS, type AchievementDef } from "@/lib/achievements/definitions";
import { getAchievementsView } from "@/lib/achievements/evaluate";
import { formatDate, formatNumber } from "@/lib/i18n/format";
import type { AppLocale } from "@/lib/i18n/config";

/**
 * Digitaal Gym Passport — een persoonlijk logboek van de belangrijkste mijlpalen.
 * Combineert `passport:true`-achievements (stempels: behaald/vergrendeld) met
 * berekende levensfeiten (lid sinds, langste streak, grootste volume).
 */

export type PassportStamp = {
  def: AchievementDef;
  earned: boolean;
  earnedAt: Date | null;
};

export type PassportFact = {
  key: string;
  label: string;
  value: string;
  icon: LucideIcon;
};

export type Passport = {
  memberSince: Date | null;
  memberSinceLabel: string;
  stamps: PassportStamp[];
  facts: PassportFact[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

type Translator = Awaited<ReturnType<typeof getTranslations>>;

function durationLabel(days: number, t: Translator): string {
  if (days < 31) return t("passport.days", { count: days });
  const months = Math.floor(days / 30.44);
  if (months < 12) return t("passport.months", { count: months });
  const years = Math.floor(months / 12);
  const restMonths = months % 12;
  return restMonths > 0
    ? t("passport.yearsMonths", { years, months: restMonths })
    : t("passport.years", { count: years });
}

export async function buildPassport(memberId: string, tenantId: string): Promise<Passport> {
  const [view, user, firstSession, t, locale] = await Promise.all([
    getAchievementsView(memberId, tenantId),
    prisma.user.findFirst({ where: { id: memberId, tenantId }, select: { createdAt: true } }),
    prisma.workoutSession.findFirst({
      where: { tenantId, userId: memberId, endedAt: { not: null } },
      orderBy: { startedAt: "asc" },
      select: { startedAt: true },
    }),
    getTranslations("achievements"),
    getLocale() as Promise<AppLocale>,
  ]);

  const stampTitle = (key: string) => t(`items.${key.replace(/\./g, "_")}.title`);
  const stampDesc = (key: string) => t(`items.${key.replace(/\./g, "_")}.description`);
  const earnedByKey = new Map(view.items.map((i) => [i.def.key, i]));
  const stamps: PassportStamp[] = ACHIEVEMENTS.filter((d) => d.passport).map((def) => {
    const item = earnedByKey.get(def.key);
    return {
      def: { ...def, title: stampTitle(def.key), description: stampDesc(def.key) },
      earned: item?.earned ?? false,
      earnedAt: item?.earnedAt ?? null,
    };
  });

  const memberSince = user?.createdAt ?? null;
  const memberDays = memberSince ? Math.floor((Date.now() - memberSince.getTime()) / DAY_MS) : 0;

  const facts: PassportFact[] = [
    {
      key: "memberSince",
      label: t("passport.memberSince"),
      value: memberSince ? formatDate(memberSince, locale, "long") : "—",
      icon: Calendar,
    },
    {
      key: "firstTraining",
      label: t("passport.firstTraining"),
      value: firstSession ? formatDate(firstSession.startedAt, locale, "long") : t("passport.notYet"),
      icon: Dumbbell,
    },
    {
      key: "longestStreak",
      label: t("passport.longestStreak"),
      value:
        view.metrics.longestStreakDays > 0
          ? t("passport.days", { count: view.metrics.longestStreakDays })
          : "—",
      icon: Flame,
    },
    {
      key: "biggestVolume",
      label: t("passport.biggestVolume"),
      value: `${formatNumber(view.metrics.totalVolume, locale)} kg`,
      icon: Dumbbell,
    },
  ];

  return {
    memberSince,
    memberSinceLabel: memberSince ? durationLabel(memberDays, t) : "—",
    stamps,
    facts,
  };
}
