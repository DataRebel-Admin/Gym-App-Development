import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireMember, getMemberHistory } from "@/lib/member";
import { getMemberStats, getRecentSessions, loadMemberClasses } from "@/lib/member-stats";
import { trainerDisplayName } from "@/lib/schema-status";
import { formatTimeRange } from "@/lib/datetime";
import { isFeatureEnabled } from "@/lib/features/service";
import { getMemberAgenda } from "@/lib/calendar";
import { nextMonthKey, prevMonthKey } from "@/lib/calendar-plan";
import { AgendaCalendar } from "@/components/calendar/agenda-calendar";
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
  PersonStanding,
  Users,
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
  const [{ series }, stats, sessions, classes, t, locale] = await Promise.all([
    getMemberHistory(member.id, member.tenantId),
    getMemberStats(member.id, member.tenantId),
    getRecentSessions(member.id, member.tenantId, 20),
    // Gedeelde, per-request gecachete loader: dit is dezelfde fetch die
    // getMemberStats hierboven al doet.
    loadMemberClasses(member.id, member.tenantId),
    getTranslations("member.history"),
    getLocale(),
  ]);
  // Nieuwste eerst, net als de sessielijst (de loader levert oplopend).
  const recentClasses = [...classes].reverse().slice(0, 20);

  const dateFmt = new Intl.DateTimeFormat(LOCALE_META[locale as AppLocale].bcp47, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  const totalHours = Math.round((stats.totalDurationSec / 3600) * 10) / 10;
  // Een lid dat alléén groepslessen doet heeft wel degelijk historie — dat gaf
  // eerder de lege staat ("nog geen trainingen") terwijl er twintig lessen in
  // zaten.
  const hasActivity = stats.totalWorkouts > 0 || stats.classesAttended > 0;

  // Agenda-preview (lopende maand): elke tik navigeert dóór naar /member/agenda.
  const calendarEnabled = await isFeatureEnabled(member.tenantId, "calendar");
  const agenda = calendarEnabled
    ? await getMemberAgenda(member.id, member.tenantId, null)
    : null;
  const agendaMonthTitle = agenda
    ? new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(
        new Date(
          Date.UTC(
            Number(agenda.monthKey.slice(0, 4)),
            Number(agenda.monthKey.slice(5)) - 1,
            1
          )
        )
      )
    : "";

  // Herkomst per sessie: welke sessies zijn door een trainer gedraaid (PT-sessie).
  const conductedRows =
    sessions.length > 0
      ? await prisma.workoutSession.findMany({
          where: {
            tenantId: member.tenantId,
            userId: member.id,
            id: { in: sessions.map((s) => s.id) },
            conductedById: { not: null },
          },
          select: { id: true, conductedById: true },
        })
      : [];
  // Eenmalige workouts (catalogus of ander schema) krijgen hun schemanaam als
  // label — die horen niet bij het actieve schema en zijn anders niet te
  // onderscheiden van een gewone trainingsdag.
  const oneOffRows =
    sessions.length > 0
      ? await prisma.workoutSession.findMany({
          where: {
            tenantId: member.tenantId,
            userId: member.id,
            id: { in: sessions.map((s) => s.id) },
            oneOff: true,
            templateId: { not: null },
          },
          select: { id: true, templateId: true },
        })
      : [];
  const oneOffTemplates =
    oneOffRows.length > 0
      ? await prisma.workoutTemplate.findMany({
          where: {
            tenantId: member.tenantId,
            id: { in: oneOffRows.map((r) => r.templateId!) },
          },
          select: { id: true, name: true },
        })
      : [];
  const templateName = new Map(oneOffTemplates.map((t) => [t.id, t.name]));
  const oneOffName = new Map(
    oneOffRows.flatMap((r) => {
      const name = r.templateId ? templateName.get(r.templateId) : null;
      return name ? [[r.id, name] as const] : [];
    })
  );
  const conductorIds = [...new Set(conductedRows.map((r) => r.conductedById!).filter(Boolean))];
  const conductors =
    conductorIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: conductorIds }, tenantId: member.tenantId },
          select: { id: true, name: true, email: true },
        })
      : [];
  const conductorName = new Map(conductors.map((c) => [c.id, trainerDisplayName(c)]));
  const conductedBy = new Map(
    conductedRows.map((r) => [r.id, conductorName.get(r.conductedById!) ?? null])
  );

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
            <StatCard label={t("kpiWorkouts")} value={stats.totalWorkouts} icon={<Activity className="size-4" />} hint={t("kpiTotal")} href="/member/history/stat/workouts" />
            <StatCard label={t("kpiStreak")} value={stats.currentStreakWeeks} suffix={t("weekSuffix")} icon={<Flame className="size-4" />} hint={t("kpiStreakHint", { count: stats.longestStreakWeeks })} />
            <StatCard label={t("kpiVolume")} value={stats.totalVolume} suffix=" kg" icon={<Dumbbell className="size-4" />} hint={t("kpiVolumeHint")} href="/member/history/stat/volume?range=all" />
            <StatCard label={t("kpiTime")} value={totalHours} suffix={t("hourSuffix")} icon={<Clock className="size-4" />} hint={t("kpiTotal")} href="/member/history/stat/time?range=all" />
            {/* Groepslessen tellen mee als trainingsmoment (streak + heatmap),
                dus horen ze ook zichtbaar te zijn. Alleen tonen zodra er iets
                te tonen valt — anders is het een lege tegel voor iedereen die
                geen lessen doet. */}
            {stats.classesAttended > 0 ? (
              <StatCard
                label={t("kpiClasses")}
                value={stats.classesAttended}
                icon={<Users className="size-4" />}
                hint={t("kpiClassesHint")}
                href="/member/rooster"
              />
            ) : null}
          </RevealItem>

          {/* Consistentie-heatmap */}
          <RevealItem className="rounded-3xl border border-border bg-surface-1 p-5 shadow-sm">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-neutral-400">
              {t("consistency")}
            </p>
            <TrainingHeatmap days={stats.heatmap} />
          </RevealItem>

          {/* Agenda-preview: het maandraster van de agenda, doorklikbaar. */}
          {agenda ? (
            <RevealItem className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                  {t("agendaTitle")}
                </p>
                <Link
                  href="/member/agenda"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-accent"
                >
                  {t("openAgenda")} <ChevronRight className="size-3.5" />
                </Link>
              </div>
              <AgendaCalendar
                agenda={agenda}
                monthTitle={agendaMonthTitle}
                prevHref={`/member/agenda?m=${prevMonthKey(agenda.monthKey)}`}
                nextHref={`/member/agenda?m=${nextMonthKey(agenda.monthKey)}`}
                mode="link"
              />
            </RevealItem>
          ) : null}

          {/* Weekvolume — de kop linkt door, de grafiek zelf blijft aantikbaar (tooltip). */}
          <RevealItem className="rounded-3xl border border-border bg-surface-1 p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                {t("weekVolume")}
              </p>
              <Link
                href="/member/history/stat/volume?range=weeks"
                className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-accent"
              >
                {t("weekVolumeCta")} <ChevronRight className="size-3.5" />
              </Link>
            </div>
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

          {/* Gevolgde groepslessen. Bewust een eigen lijst naast de sessies:
              het zijn andere gegevens (geen sets/volume, wel een lestype en
              een instructeur), en ze door elkaar zetten maakt beide onleesbaar. */}
          {recentClasses.length > 0 ? (
            <RevealItem className="flex flex-col gap-3">
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                {t("classesTitle")}
              </p>
              <ul className="flex flex-col gap-2">
                {recentClasses.map((c) => (
                  <li
                    key={c.enrollmentId}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface-1 px-4 py-3 shadow-sm"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-neutral-900">
                        {c.className}
                      </span>
                      <span className="block text-xs text-neutral-500">
                        <span className="capitalize">{dateFmt.format(c.startsAt)}</span>
                        {" · "}
                        {formatTimeRange(c.startsAt, c.endsAt, c.timezone)}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-neutral-600">
                      {t("classRow")}
                    </span>
                  </li>
                ))}
              </ul>
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
                    id={`sessie-${s.id}`}
                    className="scroll-mt-24 rounded-2xl border border-border bg-surface-1 p-4 shadow-sm"
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
                    {conductedBy.get(s.id) ? (
                      <p className="mt-2 flex items-center gap-1.5 text-xs text-neutral-500">
                        <PersonStanding className="size-3.5 text-accent" />
                        {t("conductedBy", { trainer: conductedBy.get(s.id)! })}
                      </p>
                    ) : null}
                    {oneOffName.get(s.id) ? (
                      <p className="mt-2 flex items-center gap-1.5 text-xs text-neutral-500">
                        <Dumbbell className="size-3.5 text-accent" />
                        {t("oneOffSession", { name: oneOffName.get(s.id)! })}
                      </p>
                    ) : null}
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
