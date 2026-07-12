import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { requireMember, getMemberHistory } from "@/lib/member";
import { getMemberStats, getRecentSessions } from "@/lib/member-stats";
import { LOCALE_META, type AppLocale } from "@/lib/i18n/config";
import { formatNumber } from "@/lib/i18n/format";
import { HistoryChart } from "./history-chart.lazy";
import { Reveal, RevealItem } from "@/components/motion/reveal";
import { StatCard } from "@/components/ui/stat-card";
import { TrainingHeatmap } from "@/components/charts/training-heatmap";
import { MiniBarChart } from "@/components/charts/mini-bar-chart.lazy";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Activity,
  Flame,
  Dumbbell,
  Clock,
  Trophy,
  ChevronRight,
} from "@/components/ui/icons";

export async function generateMetadata() {
  const t = await getTranslations("member.history");
  return { title: t("metaTitle") };
}

function fmtDuration(
  sec: number,
  t: Awaited<ReturnType<typeof getTranslations<"member.history">>>,
) {
  const m = Math.round(sec / 60);
  return m >= 60
    ? t("durationHm", { hours: Math.floor(m / 60), minutes: m % 60 })
    : t("durationM", { minutes: m });
}

export default async function MemberHistoryPage() {
  const member = await requireMember();
  const [{ series }, stats, sessions, t, locale] = await Promise.all([
    getMemberHistory(member.id, member.tenantId),
    getMemberStats(member.id, member.tenantId),
    getRecentSessions(member.id, member.tenantId, 20),
    getTranslations("member.history"),
    getLocale(),
  ]);

  const dateFmt = new Intl.DateTimeFormat(LOCALE_META[locale as AppLocale].bcp47, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  const totalHours = Math.round((stats.totalDurationSec / 3600) * 10) / 10;
  const hasActivity = stats.totalWorkouts > 0;

  return (
    <Reveal stagger className="flex flex-1 flex-col gap-6 px-5 py-8">
      <RevealItem>
        <h1 className="font-display text-2xl font-bold tracking-tight text-neutral-900">
          {t("title")}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">{t("subtitle")}</p>
      </RevealItem>

      {!hasActivity ? (
        <RevealItem>
          <EmptyState
            icon={<Activity className="size-7 text-accent" />}
            title={t("emptyTitle")}
            description={t("emptyDesc")}
            action={
              <Link
                href="/member/schema"
                className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground active:opacity-90"
              >
                {t("startTraining")}
              </Link>
            }
          />
        </RevealItem>
      ) : (
        <>
          {/* KPI's */}
          <RevealItem className="grid grid-cols-2 gap-3">
            <StatCard label={t("kpiWorkouts")} value={stats.totalWorkouts} icon={<Activity className="size-4" />} hint={t("kpiTotal")} />
            <StatCard label={t("kpiStreak")} value={stats.currentStreakWeeks} suffix={t("weekSuffix")} icon={<Flame className="size-4" />} hint={t("kpiStreakHint", { count: stats.longestStreakWeeks })} />
            <StatCard label={t("kpiVolume")} value={stats.totalVolume} suffix=" kg" icon={<Dumbbell className="size-4" />} hint={t("kpiVolumeHint")} />
            <StatCard label={t("kpiTime")} value={totalHours} suffix={t("hourSuffix")} icon={<Clock className="size-4" />} hint={t("kpiTotal")} />
          </RevealItem>

          {/* Consistentie-heatmap */}
          <RevealItem className="rounded-3xl border border-border bg-surface-1 p-5 shadow-sm">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-neutral-400">
              {t("consistency")}
            </p>
            <TrainingHeatmap days={stats.heatmap} />
          </RevealItem>

          {/* Weekvolume */}
          <RevealItem className="rounded-3xl border border-border bg-surface-1 p-5 shadow-sm">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-neutral-400">
              {t("weekVolume")}
            </p>
            <MiniBarChart
              data={stats.weekVolume.map((w) => ({ label: w.label, value: w.volume }))}
              unit="kg"
            />
          </RevealItem>

          {/* Persoonlijke records */}
          {stats.records.length > 0 ? (
            <RevealItem className="rounded-3xl border border-border bg-surface-1 p-5 shadow-sm">
              <p className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-neutral-400">
                <Trophy className="size-4 text-accent" /> {t("prTitle")}
              </p>
              <ul className="flex flex-col gap-2">
                {stats.records.slice(0, 6).map((r) => (
                  <li key={r.exerciseId}>
                    <Link
                      href={`/member/history/exercise/${r.exerciseId}`}
                      className="flex items-center gap-3 rounded-xl bg-surface-0 px-3 py-2.5 active:bg-surface-2"
                    >
                      <span className="min-w-0 flex-1 truncate font-medium text-neutral-900">
                        {r.name}
                      </span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-neutral-700">
                        {r.weightKg} kg × {r.reps}
                      </span>
                      <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">
                        ~{r.oneRm} 1RM
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-neutral-300" />
                    </Link>
                  </li>
                ))}
              </ul>
            </RevealItem>
          ) : null}

          {/* Gewichtsprogressie */}
          {series.length > 0 ? (
            <RevealItem className="rounded-3xl border border-border bg-surface-1 p-5 shadow-sm">
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-neutral-400">
                {t("weightProgress")}
              </p>
              <HistoryChart series={series} />
            </RevealItem>
          ) : null}

          {/* Eerdere sessies als kaarten */}
          <RevealItem className="flex flex-col gap-3">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">
              {t("pastSessions")}
            </p>
            {sessions.length === 0 ? (
              <p className="text-sm text-neutral-500">{t("noPastSessions")}</p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {sessions.map((s) => (
                  <li
                    key={s.id}
                    className="rounded-2xl border border-border bg-surface-1 p-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-display font-bold capitalize text-neutral-900">
                        {dateFmt.format(s.startedAt)}
                      </span>
                      <span className="text-xs text-neutral-500">
                        {t("sessionMeta", { count: s.exerciseCount, duration: fmtDuration(s.durationSec, t) })}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-4 text-sm text-neutral-600">
                      <span className="inline-flex items-center gap-1">
                        <Dumbbell className="size-3.5 text-accent" />
                        {formatNumber(s.totalVolume, locale as AppLocale)} kg
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Activity className="size-3.5 text-accent" />
                        {t("setsCount", { count: s.totalSets })}
                      </span>
                    </div>
                    {s.muscles.length > 0 ? (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {s.muscles.map((m) => (
                          <span
                            key={m}
                            className="rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px] font-medium text-neutral-600"
                          >
                            {m}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </RevealItem>
        </>
      )}
    </Reveal>
  );
}
