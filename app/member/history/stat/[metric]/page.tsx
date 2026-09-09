import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { requireMember } from "@/lib/member";
import {
  getMemberStats,
  getRecentSessions,
  getVolumeByExercise,
  getWeeklyVolume,
  parseWeekKey,
  startOfWeek,
  VOLUME_TREND_WEEKS,
  type RecentSession,
} from "@/lib/member-stats";
import { LOCALE_META, type AppLocale } from "@/lib/i18n/config";
import { formatNumber } from "@/lib/i18n/format";
import { Reveal, RevealItem } from "@/components/motion/reveal";
import { BackButton } from "@/components/member/back-button";
import { EmptyState } from "@/components/ui/empty-state";
import { MiniBarChart } from "@/components/charts/mini-bar-chart.lazy";
import { Activity, ChevronRight, Clock, Dumbbell } from "@/components/ui/icons";

/**
 * Drilldown achter de statistiek-tegels (member-home én historie-KPI's): laat de
 * OPBOUW van het getal zien i.p.v. het getal nogmaals. `volume` = volume per
 * oefening (doorklikbaar naar de oefening-detailpagina), `time` = sessies met hun
 * duur, `workouts` = alle afgeronde trainingen per maand. `?range=all` schakelt
 * volume/tijd van het weekvenster (dashboard-tegel) naar all-time (historie-KPI);
 * `?range=weeks` is de trend achter de weekvolume-grafiek (12 weken, doorklikbaar
 * per week) en `?week=YYYY-MM-DD` de opbouw van een van die weken.
 * De cijfers komen uit dezelfde gecachte bron ([[loadMemberSessions]]) als de
 * tegels zelf, dus de uitsplitsing telt altijd op tot het getoonde totaal.
 */

const METRICS = ["volume", "time", "workouts"] as const;
type Metric = (typeof METRICS)[number];

function parseMetric(raw: string): Metric | null {
  return (METRICS as readonly string[]).includes(raw) ? (raw as Metric) : null;
}

type T = Awaited<ReturnType<typeof getTranslations<"member.statDetail">>>;

/**
 * Welk volume-venster de URL vraagt. Een onleesbare `?week=` valt terug op de
 * lopende week i.p.v. een 404: een verlopen link mag geen doodlopend eind zijn.
 */
type VolumeView =
  | { kind: "week" }
  | { kind: "all" }
  | { kind: "weeks" }
  | { kind: "one"; start: Date };

function parseVolumeView(sp: { range?: string; week?: string }): VolumeView {
  if (sp.week) {
    const start = parseWeekKey(sp.week);
    if (start) return { kind: "one", start };
  }
  if (sp.range === "weeks") return { kind: "weeks" };
  if (sp.range === "all") return { kind: "all" };
  return { kind: "week" };
}

/** "1 t/m 7 sep": de maand staat alleen vooraan als de week 'm oversteekt. */
function weekRangeLabel(start: Date, bcp47: string, t: T): string {
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  const dayOnly = new Intl.DateTimeFormat(bcp47, { day: "numeric" });
  const dayMonth = new Intl.DateTimeFormat(bcp47, { day: "numeric", month: "short" });
  return t("weekRange", {
    from: start.getMonth() === end.getMonth() ? dayOnly.format(start) : dayMonth.format(start),
    to: dayMonth.format(end),
  });
}

function volumeTitle(view: VolumeView, t: T, bcp47: string): string {
  if (view.kind === "all") return t("volumeAllTitle");
  if (view.kind === "weeks") return t("volumeWeeksTitle", { count: VOLUME_TREND_WEEKS });
  if (view.kind === "one")
    return t("volumeWeekTitle", { range: weekRangeLabel(view.start, bcp47, t) });
  return t("volumeTitle");
}

function volumeSubtitle(view: VolumeView, t: T): string {
  if (view.kind === "all") return t("volumeAllSubtitle");
  if (view.kind === "weeks") return t("volumeWeeksSubtitle");
  return t("volumeSubtitle");
}

function fmtDuration(sec: number, t: T) {
  const m = Math.round(sec / 60);
  return m >= 60
    ? t("durationHm", { hours: Math.floor(m / 60), minutes: m % 60 })
    : t("durationM", { minutes: m });
}

function titleKey(metric: Metric, all: boolean) {
  if (metric === "volume") return all ? "volumeAllTitle" : "volumeTitle";
  if (metric === "time") return all ? "timeAllTitle" : "timeTitle";
  return "workoutsTitle";
}

function subtitleKey(metric: Metric, all: boolean) {
  if (metric === "volume") return all ? "volumeAllSubtitle" : "volumeSubtitle";
  if (metric === "time") return all ? "timeAllSubtitle" : "timeSubtitle";
  return "workoutsSubtitle";
}

type PageProps = {
  params: Promise<{ metric: string }>;
  searchParams: Promise<{ range?: string; week?: string }>;
};

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const metric = parseMetric((await params).metric);
  const sp = await searchParams;
  const [t, locale] = await Promise.all([getTranslations("member.statDetail"), getLocale()]);
  if (metric === "volume") {
    return { title: volumeTitle(parseVolumeView(sp), t, LOCALE_META[locale as AppLocale].bcp47) };
  }
  return { title: metric ? t(titleKey(metric, sp.range === "all")) : t("workoutsTitle") };
}

export default async function StatDetailPage({ params, searchParams }: PageProps) {
  const metric = parseMetric((await params).metric);
  if (!metric) notFound();
  const sp = await searchParams;
  const all = sp.range === "all";
  const view = parseVolumeView(sp);

  const member = await requireMember();
  const [stats, t, locale] = await Promise.all([
    getMemberStats(member.id, member.tenantId),
    getTranslations("member.statDetail"),
    getLocale(),
  ]);
  const appLocale = locale as AppLocale;
  const bcp47 = LOCALE_META[appLocale].bcp47;
  const dateFmt = new Intl.DateTimeFormat(bcp47, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const chartFmt = new Intl.DateTimeFormat(bcp47, { day: "numeric", month: "numeric" });

  const sessionRow = (s: RecentSession) => (
    <li
      key={s.id}
      className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface-1 px-4 py-3 shadow-sm"
    >
      <div className="min-w-0">
        <span className="font-medium capitalize text-neutral-900">
          {dateFmt.format(s.startedAt)}
        </span>
        <p className="mt-0.5 text-xs text-neutral-500">
          {t("sessionMeta", {
            exercises: s.exerciseCount,
            sets: s.totalSets,
            volume: formatNumber(s.totalVolume, appLocale),
          })}
        </p>
      </div>
      <span className="shrink-0 font-display font-bold tabular-nums text-neutral-900">
        {fmtDuration(s.durationSec, t)}
      </span>
    </li>
  );

  // Sessies per maand (sessies zijn al aflopend gesorteerd → groepen ook).
  const monthGroups = (sessions: RecentSession[]) => {
    const monthFmt = new Intl.DateTimeFormat(bcp47, { month: "long", year: "numeric" });
    const byMonth = new Map<string, RecentSession[]>();
    for (const s of sessions) {
      const key = monthFmt.format(s.startedAt);
      const group = byMonth.get(key);
      if (group) group.push(s);
      else byMonth.set(key, [s]);
    }
    return (
      <div className="flex flex-col gap-5">
        {[...byMonth.entries()].map(([month, group]) => (
          <div key={month} className="flex flex-col gap-2.5">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">
              {month}
            </p>
            <ul className="flex flex-col gap-2.5">{group.map(sessionRow)}</ul>
          </div>
        ))}
      </div>
    );
  };

  const rangeHint = all ? t("totalAllTime") : t("totalThisWeek");
  let headline: { value: string; suffix: string; hint: string; icon: React.ReactNode };
  let content: React.ReactNode;

  if (metric === "volume" && view.kind === "weeks") {
    const weeks = await getWeeklyVolume(member.id, member.tenantId);
    const maxVolume = Math.max(...weeks.map((w) => w.volume));
    const totalVolume = weeks.reduce((sum, w) => sum + w.volume, 0);
    const rowBox = "block rounded-2xl border border-border bg-surface-1 p-4 shadow-sm";
    headline = {
      value: formatNumber(totalVolume, appLocale),
      suffix: "kg",
      hint: t("totalLastWeeks", { count: VOLUME_TREND_WEEKS }),
      icon: <Dumbbell className="size-4" />,
    };
    content =
      totalVolume === 0 ? (
        <EmptyState
          icon={<Dumbbell className="size-7 text-accent" />}
          title={t("volumeWeeksTitle", { count: VOLUME_TREND_WEEKS })}
          description={t("volumeWeeksEmpty")}
        />
      ) : (
        <div className="flex flex-col gap-5">
          <div className="rounded-3xl border border-border bg-surface-1 p-5 shadow-sm">
            <MiniBarChart
              data={[...weeks]
                .reverse()
                .map((w) => ({ label: chartFmt.format(w.start), value: w.volume }))}
              unit="kg"
            />
          </div>
          <ul className="flex flex-col gap-2.5">
            {weeks.map((w) => {
              const row = (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="truncate font-medium text-neutral-900">
                        {weekRangeLabel(w.start, bcp47, t)}
                      </span>
                      {w.isCurrent ? (
                        <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">
                          {t("currentWeek")}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-sm font-bold tabular-nums text-neutral-900">
                      {formatNumber(w.volume, appLocale)} kg
                    </span>
                    {w.volume > 0 ? (
                      <ChevronRight className="size-4 shrink-0 text-neutral-300" />
                    ) : null}
                  </div>
                  <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{
                        width: `${w.volume > 0 ? Math.max(3, Math.round((w.volume / maxVolume) * 100)) : 0}%`,
                      }}
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-neutral-500">
                    {t("weekWorkouts", { count: w.workouts })}
                  </p>
                </>
              );
              // Een week zonder gewichtsvolume heeft geen opbouw om te tonen, dus geen link.
              return (
                <li key={w.key}>
                  {w.volume > 0 ? (
                    <Link
                      href={`/member/history/stat/volume?week=${w.key}`}
                      className={`${rowBox} transition-colors active:bg-surface-2`}
                    >
                      {row}
                    </Link>
                  ) : (
                    <div className={rowBox}>{row}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      );
  } else if (metric === "volume") {
    const rows = await getVolumeByExercise(
      member.id,
      member.tenantId,
      view.kind === "all" ? "all" : view.kind === "one" ? view.start : "week"
    );
    const maxVolume = rows[0]?.volume ?? 0;
    const totalVolume = rows.reduce((sum, r) => sum + r.volume, 0);
    headline = {
      value: formatNumber(
        view.kind === "all"
          ? stats.totalVolume
          : view.kind === "one"
            ? totalVolume
            : stats.thisWeekVolume,
        appLocale
      ),
      suffix: "kg",
      hint: view.kind === "one" ? weekRangeLabel(view.start, bcp47, t) : rangeHint,
      icon: <Dumbbell className="size-4" />,
    };
    content =
      rows.length === 0 ? (
        <EmptyState
          icon={<Dumbbell className="size-7 text-accent" />}
          title={volumeTitle(view, t, bcp47)}
          description={
            view.kind === "all"
              ? t("volumeAllEmpty")
              : view.kind === "one"
                ? t("volumeWeekEmpty")
                : t("volumeEmpty")
          }
        />
      ) : (
        <ul className="flex flex-col gap-2.5">
          {rows.map((r) => (
            <li key={r.exerciseId}>
              <Link
                href={`/member/history/exercise/${r.exerciseId}`}
                className="block rounded-2xl border border-border bg-surface-1 p-4 shadow-sm transition-colors active:bg-surface-2"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 flex-1 truncate font-medium text-neutral-900">
                    {r.name}
                  </span>
                  <span className="shrink-0 text-sm font-bold tabular-nums text-neutral-900">
                    {formatNumber(r.volume, appLocale)} kg
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-neutral-300" />
                </div>
                <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{
                      width: `${maxVolume > 0 ? Math.max(3, Math.round((r.volume / maxVolume) * 100)) : 0}%`,
                    }}
                  />
                </div>
                <p className="mt-1.5 text-xs text-neutral-500">
                  {t("setsCount", { count: r.sets })} ·{" "}
                  {t("heaviestSet", {
                    weight: formatNumber(r.topWeightKg, appLocale),
                    reps: r.topReps,
                  })}
                  {totalVolume > 0
                    ? ` · ${t(view.kind === "all" ? "shareOfTotal" : "shareOfWeek", { pct: Math.round((r.volume / totalVolume) * 100) })}`
                    : ""}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      );
  } else if (metric === "time") {
    const weekStart = startOfWeek(new Date()).getTime();
    const sessions = all
      ? await getRecentSessions(member.id, member.tenantId, 1000)
      : (await getRecentSessions(member.id, member.tenantId, 100)).filter(
          (s) => s.startedAt.getTime() >= weekStart
        );
    headline = all
      ? {
          // Zelfde afronding als de historie-KPI: uren met één decimaal.
          value: formatNumber(Math.round((stats.totalDurationSec / 3600) * 10) / 10, appLocale),
          suffix: t("hourSuffix"),
          hint: rangeHint,
          icon: <Clock className="size-4" />,
        }
      : {
          value: formatNumber(Math.round(stats.thisWeekDurationSec / 60), appLocale),
          suffix: "min",
          hint: rangeHint,
          icon: <Clock className="size-4" />,
        };
    content =
      sessions.length === 0 ? (
        <EmptyState
          icon={<Clock className="size-7 text-accent" />}
          title={t(titleKey("time", all))}
          description={all ? t("workoutsEmpty") : t("timeEmpty")}
        />
      ) : all ? (
        monthGroups(sessions)
      ) : (
        <ul className="flex flex-col gap-2.5">{sessions.map(sessionRow)}</ul>
      );
  } else {
    const sessions = await getRecentSessions(member.id, member.tenantId, 1000);
    headline = {
      value: formatNumber(stats.totalWorkouts, appLocale),
      suffix: t("trainingsSuffix"),
      hint: t("totalAllTime"),
      icon: <Activity className="size-4" />,
    };
    content =
      sessions.length === 0 ? (
        <EmptyState
          icon={<Activity className="size-7 text-accent" />}
          title={t("workoutsTitle")}
          description={t("workoutsEmpty")}
        />
      ) : (
        monthGroups(sessions)
      );
  }

  return (
    <Reveal stagger className="flex flex-1 flex-col gap-5 px-5 py-6">
      <RevealItem>
        <BackButton fallback="/member" />
      </RevealItem>

      <RevealItem>
        <h1 className="font-display text-2xl font-bold tracking-tight text-neutral-900">
          {metric === "volume" ? volumeTitle(view, t, bcp47) : t(titleKey(metric, all))}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          {metric === "volume" ? volumeSubtitle(view, t) : t(subtitleKey(metric, all))}
        </p>
      </RevealItem>

      {/* Totaal, identiek aan de tegel waar je vandaan komt, zodat de opbouw eronder klopt. */}
      <RevealItem className="panel-sheen relative flex items-center justify-between overflow-hidden rounded-2xl border border-border bg-surface-1 p-5 shadow-sm">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-12 size-32 rounded-full bg-accent-soft blur-2xl"
        />
        <div className="relative">
          <span className="font-display text-3xl font-bold leading-none tabular-nums text-neutral-900">
            {headline.value}
          </span>
          <span className="ml-1.5 text-sm font-semibold text-neutral-400">
            {headline.suffix}
          </span>
          <p className="mt-1 text-xs text-neutral-500">{headline.hint}</p>
        </div>
        <span className="relative flex size-8 items-center justify-center rounded-lg bg-accent-soft text-accent">
          {headline.icon}
        </span>
      </RevealItem>

      <RevealItem>{content}</RevealItem>

      <RevealItem className="flex flex-col gap-2">
        {metric === "volume" && view.kind !== "weeks" ? (
          <Link
            href="/member/history/stat/volume?range=weeks"
            className="inline-flex items-center gap-1 text-sm font-semibold text-accent"
          >
            {t("openWeekTrend")} <ChevronRight className="size-4" />
          </Link>
        ) : null}
        <Link
          href="/member/history"
          className="inline-flex items-center gap-1 text-sm font-semibold text-accent"
        >
          {t("openFullHistory")} <ChevronRight className="size-4" />
        </Link>
      </RevealItem>
    </Reveal>
  );
}
