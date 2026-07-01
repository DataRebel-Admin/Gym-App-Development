import "server-only";
import { prisma } from "@/lib/db";
import {
  Calendar,
  Flame,
  Dumbbell,
  type LucideIcon,
} from "@/components/ui/icons";
import { ACHIEVEMENTS, type AchievementDef } from "@/lib/achievements/definitions";
import { getAchievementsView } from "@/lib/achievements/evaluate";

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
const DATE_FMT = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "long", year: "numeric" });

function durationLabel(days: number): string {
  if (days < 31) return `${days} ${days === 1 ? "dag" : "dagen"}`;
  const months = Math.floor(days / 30.44);
  if (months < 12) return `${months} ${months === 1 ? "maand" : "maanden"}`;
  const years = Math.floor(months / 12);
  const restMonths = months % 12;
  return restMonths > 0
    ? `${years} jaar ${restMonths} ${restMonths === 1 ? "maand" : "maanden"}`
    : `${years} ${years === 1 ? "jaar" : "jaar"}`;
}

export async function buildPassport(memberId: string, tenantId: string): Promise<Passport> {
  const [view, user, firstSession] = await Promise.all([
    getAchievementsView(memberId, tenantId),
    prisma.user.findFirst({ where: { id: memberId, tenantId }, select: { createdAt: true } }),
    prisma.workoutSession.findFirst({
      where: { tenantId, userId: memberId, endedAt: { not: null } },
      orderBy: { startedAt: "asc" },
      select: { startedAt: true },
    }),
  ]);

  const earnedByKey = new Map(view.items.map((i) => [i.def.key, i]));
  const stamps: PassportStamp[] = ACHIEVEMENTS.filter((d) => d.passport).map((def) => {
    const item = earnedByKey.get(def.key);
    return { def, earned: item?.earned ?? false, earnedAt: item?.earnedAt ?? null };
  });

  const memberSince = user?.createdAt ?? null;
  const memberDays = memberSince ? Math.floor((Date.now() - memberSince.getTime()) / DAY_MS) : 0;

  const facts: PassportFact[] = [
    {
      key: "memberSince",
      label: "Lid sinds",
      value: memberSince ? DATE_FMT.format(memberSince) : "—",
      icon: Calendar,
    },
    {
      key: "firstTraining",
      label: "Eerste training",
      value: firstSession ? DATE_FMT.format(firstSession.startedAt) : "Nog niet",
      icon: Dumbbell,
    },
    {
      key: "longestStreak",
      label: "Langste streak",
      value:
        view.metrics.longestStreakDays > 0
          ? `${view.metrics.longestStreakDays} ${view.metrics.longestStreakDays === 1 ? "dag" : "dagen"}`
          : "—",
      icon: Flame,
    },
    {
      key: "biggestVolume",
      label: "Totaal verplaatst",
      value: `${view.metrics.totalVolume.toLocaleString("nl-NL")} kg`,
      icon: Dumbbell,
    },
  ];

  return {
    memberSince,
    memberSinceLabel: memberSince ? durationLabel(memberDays) : "—",
    stamps,
    facts,
  };
}
