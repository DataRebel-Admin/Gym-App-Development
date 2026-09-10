import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireMember, getAssignedSchema } from "@/lib/member";
import { getMemberStats } from "@/lib/member-stats";
import { enforceSessionTimeout } from "@/lib/session-timeout";
import { publishDueSchedulesForMember } from "@/lib/schema-publish";
import { isAiEnabled } from "@/lib/ai/enabled";
import { getAchievementUiState, getAchievementsView } from "@/lib/achievements/evaluate";
import { AchievementDashboardSummary } from "@/components/achievements/dashboard-summary";
import { SchemaBadges } from "@/components/schema/schema-badges";
import { AssistantWidget } from "@/components/assistant-widget";
import { surfaceSuggestions } from "@/lib/ai";
import { Reveal, RevealItem } from "@/components/motion/reveal";
import { ProgressRing } from "@/components/ui/progress-ring";
import { StatCard } from "@/components/ui/stat-card";
import { MuscleGroupBars } from "@/components/charts/muscle-group-bars";
import { Sparkline } from "@/components/charts/sparkline";
import { EmptyState } from "@/components/ui/empty-state";
import { isFeatureEnabled } from "@/lib/features/service";
import { getMemberAgendaStrip, getMemberCalendarTimezone } from "@/lib/calendar";
import { hourPartsInTz } from "@/lib/metrics/definitions";
import { AgendaStripCard } from "@/components/calendar/agenda-strip-card";
import {
  Flame,
  Trophy,
  Dumbbell,
  Clock,
  Activity,
  QrCode,
  ChevronRight,
  Play,
  ClipboardList,
  Building2,
} from "@/components/ui/icons";

export async function generateMetadata() {
  const t = await getTranslations("member.home");
  return { title: t("metaTitle") };
}

// `hour` is het uur in de tijdzone van het lid — servertijd (UTC op Vercel) loopt uit.
function greetingKey(hour: number) {
  if (hour < 6) return "greetingNight";
  if (hour < 12) return "greetingMorning";
  if (hour < 18) return "greetingAfternoon";
  return "greetingEvening";
}

export default async function MemberHome() {
  const member = await requireMember();
  // Automatische 5-uur-timeout: sluit een te lang openstaande sessie af zodat het
  // dashboard 'm niet als "hervat training" blijft tonen. De teruggegeven sessie-id is
  // de nog-open sessie (null bij auto-stop of geen sessie) — hergebruikt zodat we
  // dezelfde open-sessie-query niet nogmaals draaien.
  // Geplande publicatie loopt mee: een schema waarvan de ingangsdatum verstreken
  // is wordt bij het openen van de app live, zonder op de dagelijkse cron te
  // wachten (lib/schema-publish.ts). Vóór `getAssignedSchema` hieronder.
  const [timeout] = await Promise.all([
    enforceSessionTimeout(member.tenantId, member.id),
    publishDueSchedulesForMember(member.tenantId, member.id),
  ]);
  const openSessionId = timeout.autoStopped ? null : timeout.sessionId;
  const [assignment, stats, timezone, t] = await Promise.all([
    getAssignedSchema(member.id, member.tenantId),
    getMemberStats(member.id, member.tenantId),
    getMemberCalendarTimezone(member.id, member.tenantId),
    getTranslations("member.home"),
  ]);
  // AI-widget: alleen als de AI-module beschikbaar is (Superadmin-flag én owner-toggle).
  const aiEnabled = await isAiEnabled(member.tenantId);
  // Agenda-widget (volgende training + dagenstrip): alleen als de module aan staat.
  const calendarEnabled = await isFeatureEnabled(member.tenantId, "calendar");
  const agendaStrip = calendarEnabled
    ? await getMemberAgendaStrip(member.id, member.tenantId)
    : null;
  // Trofeeën-widget: alleen als aan voor de gym én niet persoonlijk verborgen.
  const achievementUi = await getAchievementUiState(member.id, member.tenantId);
  const achievementsView = achievementUi.visible
    ? await getAchievementsView(member.id, member.tenantId)
    : null;

  const schema = assignment?.template;
  const isNewSchema = assignment ? assignment.seenAt === null : false;
  const trainerMessage = assignment?.trainerMessage?.trim() || null;
  const firstName = member.name?.split(" ")[0] ?? t("athleteFallback");

  const goalPct =
    stats.weeklyGoal > 0
      ? Math.min(100, Math.round((stats.workoutsThisWeek / stats.weeklyGoal) * 100))
      : 0;
  const goalRemaining = Math.max(0, stats.weeklyGoal - stats.workoutsThisWeek);
  const thisWeekMin = Math.round(stats.thisWeekDurationSec / 60);

  const motivation =
    stats.workoutsThisWeek === 0
      ? t("motivationFirst")
      : stats.workoutsThisWeek >= stats.weeklyGoal
        ? t("motivationGoalReached")
        : t("motivationRemaining", { count: goalRemaining });

  return (
    <Reveal stagger className="flex flex-1 flex-col gap-5 px-5 py-7">
      {/* Begroeting */}
      <RevealItem>
        <h1 className="font-display text-2xl font-bold tracking-tight text-neutral-900">
          {t(greetingKey(hourPartsInTz(new Date(), timezone).hour))}, {firstName} 👋
        </h1>
        <p className="mt-1 text-neutral-500">{motivation}</p>
      </RevealItem>

      {/* Nieuw-schema-melding */}
      {isNewSchema && schema ? (
        <RevealItem>
          <Link
            href="/member/schema"
            className="block rounded-3xl border border-accent/30 bg-accent-soft p-5 shadow-sm active:scale-[0.99]"
          >
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-accent-foreground">
              {t("newBadge")}
            </span>
            <p className="mt-2 font-display text-lg font-bold text-neutral-900">
              {t("newSchemaTitle")}
            </p>
            <p className="mt-0.5 text-sm text-neutral-600">
              {trainerMessage ?? t("newSchemaDefault", { name: schema.name })}
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-accent">
              {t("viewSchema")} <ChevronRight className="size-4" />
            </span>
          </Link>
        </RevealItem>
      ) : null}

      {/* Schema-hero + CTA — de primaire actie staat vóór alle voortgangsblokken */}
      <RevealItem className="panel-sheen relative overflow-hidden rounded-3xl bg-accent-gradient p-6 text-accent-foreground shadow-accent">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-8 -top-10 size-40 rounded-full bg-white/15 blur-2xl"
        />
        <p className="relative text-xs font-medium uppercase tracking-wide opacity-80">
          {openSessionId ? t("trainingBusy") : t("yourSchema")}
        </p>
        {schema ? (
          <>
            <p className="relative mt-1 font-display text-2xl font-bold">{schema.name}</p>
            <p className="relative mt-0.5 text-sm opacity-90">
              {t("exercisesCount", { count: schema.items.length })}
              {schema.days.length > 1 ? ` · ${t("daysCount", { count: schema.days.length })}` : ""}
            </p>
            <div className="relative mt-2">
              <SchemaBadges badges={schema.badges} size="xs" max={4} />
            </div>
            <Link
              href={openSessionId ? "/member/schema/active" : "/member/schema"}
              className="relative mt-4 flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 text-center text-lg font-bold text-[#171717] shadow-md transition-transform active:scale-[0.98]"
            >
              <Play className="size-5 fill-current" />
              {openSessionId ? t("resumeTraining") : t("startTraining")}
            </Link>
          </>
        ) : (
          <>
            <p className="relative mt-2 text-sm opacity-90">
              {t("noSchemaRequest")}
            </p>
            <Link
              href="/member/requests"
              className="relative mt-4 flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-3.5 text-center text-base font-bold text-[#171717] shadow-md transition-transform active:scale-[0.98]"
            >
              <ClipboardList className="size-5" /> {t("requestSchema")}
            </Link>
          </>
        )}
      </RevealItem>

      {/* Volgende training + dagenstrip (agenda-widget) */}
      {agendaStrip ? (
        <RevealItem>
          <AgendaStripCard strip={agendaStrip} />
        </RevealItem>
      ) : null}

      {/* Weekdoel + streak */}
      <RevealItem className="flex items-center gap-4 rounded-3xl border border-border bg-surface-1 p-5 shadow-sm">
        <ProgressRing
          value={goalPct}
          size={104}
          strokeWidth={10}
          label={`${stats.workoutsThisWeek}/${stats.weeklyGoal}`}
          sublabel={t("weekGoal")}
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">
            {t("thisWeek")}
          </p>
          <p className="mt-0.5 font-display text-lg font-bold leading-tight text-neutral-900">
            {stats.workoutsThisWeek === 0
              ? t("notTrainedYet")
              : t("trainingsThisWeek", { count: stats.workoutsThisWeek })}
          </p>
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent">
            <Flame className="size-3.5" />
            {stats.currentStreakWeeks > 0
              ? t("streak", { count: stats.currentStreakWeeks })
              : t("startStreak")}
          </div>
        </div>
      </RevealItem>

      {/* Quick stats */}
      <RevealItem className="grid grid-cols-3 gap-3">
        <StatCard
          label={t("statVolume")}
          value={stats.thisWeekVolume}
          suffix=" kg"
          icon={<Dumbbell className="size-4" />}
          hint={t("hintThisWeek")}
          href="/member/history/stat/volume"
        />
        <StatCard
          label={t("statTime")}
          value={thisWeekMin}
          suffix=" min"
          icon={<Clock className="size-4" />}
          hint={t("hintThisWeek")}
          href="/member/history/stat/time"
        />
        <StatCard
          label={t("statTotal")}
          value={stats.totalWorkouts}
          icon={<Activity className="size-4" />}
          hint={t("hintTrainings")}
          href="/member/history/stat/workouts"
        />
      </RevealItem>

      {/* Trofeeën & mijlpalen */}
      {achievementsView ? (
        <RevealItem>
          <AchievementDashboardSummary view={achievementsView} />
        </RevealItem>
      ) : null}

      {/* Scan + oefeningen */}
      <RevealItem className="grid grid-cols-2 gap-3">
        <Link
          href="/member/scan"
          className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-surface-1 px-4 py-4 text-center text-sm font-semibold text-neutral-900 shadow-sm transition-colors active:bg-surface-2"
        >
          <QrCode className="size-5 text-accent" /> {t("scanMachine")}
        </Link>
        <Link
          href="/member/exercises"
          className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-surface-1 px-4 py-4 text-center text-sm font-semibold text-neutral-900 shadow-sm transition-colors active:bg-surface-2"
        >
          <Dumbbell className="size-5 text-accent" /> {t("exercises")}
        </Link>
      </RevealItem>

      {/* Schema aanvragen + sportschool — zonder schema toont de hero de aanvraag-CTA al */}
      <RevealItem className="grid grid-cols-2 gap-3">
        {schema ? (
          <Link
            href="/member/requests"
            className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-surface-1 px-4 py-4 text-center text-sm font-semibold text-neutral-900 shadow-sm transition-colors active:bg-surface-2"
          >
            <ClipboardList className="size-5 text-accent" /> {t("requestSchema")}
          </Link>
        ) : null}
        <Link
          href="/member/gym"
          className={`flex items-center justify-center gap-2 rounded-2xl border border-border bg-surface-1 px-4 py-4 text-center text-sm font-semibold text-neutral-900 shadow-sm transition-colors active:bg-surface-2${schema ? "" : " col-span-2"}`}
        >
          <Building2 className="size-5 text-accent" /> {t("gym")}
        </Link>
      </RevealItem>

      {/* Weekvolume-trend — doorklikbaar naar de opbouw per week en per oefening. */}
      {stats.totalWorkouts > 0 ? (
        <RevealItem>
          <Link
            href="/member/history/stat/volume?range=weeks"
            className="block rounded-3xl border border-border bg-surface-1 p-5 shadow-sm transition-colors active:bg-surface-2"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                  {t("weekVolume")}
                </p>
                <p className="mt-0.5 font-display text-xl font-bold text-neutral-900">
                  {t("last12Weeks")}
                </p>
              </div>
              <Sparkline data={stats.weekVolume.map((w) => w.volume)} width={120} height={40} />
            </div>
            <p className="mt-3 flex items-center gap-1 text-sm font-semibold text-accent">
              {t("weekVolumeCta")} <ChevronRight className="size-4" />
            </p>
          </Link>
        </RevealItem>
      ) : null}

      {/* Spiergroepen */}
      {stats.muscleGroups.length > 0 ? (
        <RevealItem>
          <Link
            href="/member/muscles?weergave=getraind"
            className="block rounded-3xl border border-border bg-surface-1 p-5 shadow-sm transition-colors active:bg-surface-2"
          >
            <p className="mb-3 flex items-center justify-between text-xs font-medium uppercase tracking-wide text-neutral-400">
              {t("muscleGroupsTrained")}
              <ChevronRight className="size-4 text-neutral-300" />
            </p>
            <MuscleGroupBars data={stats.muscleGroups} />
          </Link>
        </RevealItem>
      ) : null}

      {/* Recente PR's */}
      {stats.recentRecords.length > 0 ? (
        <RevealItem className="rounded-3xl border border-border bg-surface-1 p-5 shadow-sm">
          <p className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-neutral-400">
            <Trophy className="size-4 text-accent" /> {t("recentRecordsTitle")}
          </p>
          <ul className="flex flex-col gap-2">
            {stats.recentRecords.slice(0, 4).map((r) => (
              <li key={r.exerciseId}>
                <Link
                  href={`/member/history/exercise/${r.exerciseId}`}
                  className="flex items-center gap-3 rounded-xl bg-surface-0 px-3 py-2.5 active:bg-surface-2"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                    <Trophy className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium text-neutral-900">
                    {r.name}
                  </span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-neutral-700">
                    {r.weightKg} kg × {r.reps}
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-neutral-300" />
                </Link>
              </li>
            ))}
          </ul>
        </RevealItem>
      ) : null}

      {/* Lege staat bij nog geen activiteit */}
      {stats.totalWorkouts === 0 && schema ? (
        <RevealItem>
          <EmptyState
            icon={<Dumbbell className="size-7 text-accent" />}
            title={t("emptyTitle")}
            description={t("emptyDesc")}
          />
        </RevealItem>
      ) : null}

      {aiEnabled ? (
        <RevealItem>
          <AssistantWidget suggestions={surfaceSuggestions("member-home")} />
        </RevealItem>
      ) : null}
    </Reveal>
  );
}
