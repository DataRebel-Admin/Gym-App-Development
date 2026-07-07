import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ProgressRing } from "@/components/ui/progress-ring";
import { Trophy, ChevronRight } from "@/components/ui/icons";
import { AchievementBadge } from "@/components/achievements/achievement-badge";
import type { AchievementsView } from "@/lib/achievements/evaluate";

const DATE_FMT = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short" });

/**
 * Compacte trofeeën-widget voor het lid-dashboard: laatste behaalde trofee +
 * volgende mijlpaal + niveau. Linkt door naar de volledige Trofeeën-pagina.
 */
export async function AchievementDashboardSummary({ view }: { view: AchievementsView }) {
  const t = await getTranslations("achievements.ui");
  const latest = view.latest;
  const next = view.nextUp[0];

  return (
    <div className="rounded-3xl border border-border bg-surface-1 p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-neutral-400">
          <Trophy className="size-4 text-accent" /> {t("dashboard.trophies")}
        </p>
        <Link href="/member/trophies" className="inline-flex items-center gap-0.5 text-sm font-semibold text-accent">
          {view.level.name} <ChevronRight className="size-4" />
        </Link>
      </div>

      <div className="mt-4 flex items-center gap-4">
        {latest ? (
          <Link href="/member/trophies" className="flex min-w-0 flex-1 items-center gap-3">
            <AchievementBadge icon={latest.def.icon} rarity={latest.def.rarity} earned size="md" />
            <span className="min-w-0">
              <span className="block text-[11px] font-medium uppercase tracking-wide text-neutral-400">
                {t("dashboard.lastEarned")}
              </span>
              <span className="block truncate font-display font-bold text-neutral-900">
                {latest.def.title}
              </span>
              <span className="block text-xs text-neutral-500">
                {latest.earnedAt ? DATE_FMT.format(latest.earnedAt) : ""} · {t("dashboard.total", { count: view.earnedCount })}
              </span>
            </span>
          </Link>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <AchievementBadge icon={Trophy} rarity="bronze" earned={false} size="md" />
            <span className="min-w-0">
              <span className="block font-display font-bold text-neutral-900">{t("dashboard.none")}</span>
              <span className="block text-xs text-neutral-500">{t("dashboard.startToEarn")}</span>
            </span>
          </div>
        )}
      </div>

      {next ? (
        <Link
          href="/member/trophies"
          className="mt-4 flex items-center gap-3 rounded-2xl bg-surface-0 p-3 active:bg-surface-2"
        >
          <ProgressRing
            value={Math.round(next.progress * 100)}
            size={52}
            strokeWidth={6}
            label={<span className="text-xs font-bold">{Math.round(next.progress * 100)}%</span>}
          />
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-medium uppercase tracking-wide text-neutral-400">
              {t("dashboard.nextMilestone")}
            </span>
            <span className="block truncate font-semibold text-neutral-900">{next.def.title}</span>
            <span className="block text-xs text-neutral-500">
              {next.currentLabel} / {next.targetLabel}
            </span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-neutral-300" />
        </Link>
      ) : null}
    </div>
  );
}
