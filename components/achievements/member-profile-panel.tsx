import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/cn";
import { Trophy, Flame } from "@/components/ui/icons";
import { rarityMeta } from "@/lib/achievements/rarity";
import { AchievementBadge } from "@/components/achievements/achievement-badge";
import type { AchievementsView } from "@/lib/achievements/evaluate";

/**
 * Compacte achievements-samenvatting voor het ledenprofiel (coach-weergave):
 * aantal trofeeën, mooiste achievement, trainingsniveau, langste streak en de
 * behaalde badges.
 */
export async function MemberProfileAchievements({ view }: { view: AchievementsView }) {
  const t = await getTranslations("achievements.ui");
  const earnedBadges = view.items.filter((i) => i.earned).slice(0, 12);

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-surface-1 p-5">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
          <Trophy className="size-4 text-accent" /> {t("profile.title")}
        </h2>
        <Link href="/owner/engagement" className="text-xs text-accent hover:underline">
          {t("profile.engagement")}
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-3 text-sm">
        <div>
          <p className="text-neutral-500">{t("profile.earned")}</p>
          <p className="font-display text-xl font-bold text-neutral-900">
            {view.earnedCount}
            <span className="text-sm font-medium text-neutral-400">/{view.totalCount}</span>
          </p>
        </div>
        <div>
          <p className="text-neutral-500">{t("profile.level")}</p>
          <p className="font-display text-xl font-bold text-neutral-900">{view.level.name}</p>
        </div>
        <div>
          <p className="text-neutral-500">{t("profile.longestStreak")}</p>
          <p className="flex items-center gap-1 font-display text-xl font-bold text-neutral-900">
            <Flame className="size-4 text-accent" />
            {view.metrics.longestStreakDays}
          </p>
        </div>
      </div>

      {view.best ? (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-0 p-3">
          <AchievementBadge icon={view.best.def.icon} rarity={view.best.def.rarity} earned size="md" />
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">{t("profile.bestTrophy")}</p>
            <p className="truncate font-display font-bold text-neutral-900">{view.best.def.title}</p>
            <span className={cn("mt-0.5 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold", rarityMeta(view.best.def.rarity).chip)}>
              {view.best.rarityLabel}
            </span>
          </div>
        </div>
      ) : (
        <p className="text-sm text-neutral-500">{t("profile.noTrophies")}</p>
      )}

      {earnedBadges.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {earnedBadges.map((i) => (
            <AchievementBadge key={i.def.key} icon={i.def.icon} rarity={i.def.rarity} earned size="sm" />
          ))}
        </div>
      ) : null}
    </section>
  );
}
