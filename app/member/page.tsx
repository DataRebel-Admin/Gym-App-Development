import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireMember, getAssignedSchema } from "@/lib/member";
import { getMemberStats } from "@/lib/member-stats";
import { getCurrentTenant } from "@/lib/tenant";
import { AssistantWidget } from "@/components/assistant-widget";
import { Reveal, RevealItem } from "@/components/motion/reveal";
import { ProgressRing } from "@/components/ui/progress-ring";
import { StatCard } from "@/components/ui/stat-card";
import { MuscleGroupBars } from "@/components/charts/muscle-group-bars";
import { Sparkline } from "@/components/charts/sparkline";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Flame,
  Trophy,
  Dumbbell,
  Clock,
  Activity,
  QrCode,
  ChevronRight,
  Play,
} from "@/components/ui/icons";

export const metadata = { title: "Mijn training" };

function greeting(d: Date) {
  const h = d.getHours();
  if (h < 6) return "Goedenacht";
  if (h < 12) return "Goedemorgen";
  if (h < 18) return "Goedemiddag";
  return "Goedenavond";
}

export default async function MemberHome() {
  const member = await requireMember();
  const [assignment, tenant, stats, openSession] = await Promise.all([
    getAssignedSchema(member.id, member.tenantId),
    getCurrentTenant(),
    getMemberStats(member.id, member.tenantId),
    prisma.workoutSession.findFirst({
      where: { tenantId: member.tenantId, userId: member.id, endedAt: null },
      select: { id: true },
    }),
  ]);
  const schema = assignment?.template;
  const firstName = member.name?.split(" ")[0] ?? "sporter";

  const goalPct =
    stats.weeklyGoal > 0
      ? Math.min(100, Math.round((stats.workoutsThisWeek / stats.weeklyGoal) * 100))
      : 0;
  const goalRemaining = Math.max(0, stats.weeklyGoal - stats.workoutsThisWeek);
  const thisWeekMin = Math.round(stats.thisWeekDurationSec / 60);

  const motivation =
    stats.workoutsThisWeek === 0
      ? "Klaar voor je eerste training deze week?"
      : stats.workoutsThisWeek >= stats.weeklyGoal
        ? "Je weekdoel is gehaald — sterk bezig! 🎉"
        : `Nog ${goalRemaining} ${goalRemaining === 1 ? "training" : "trainingen"} tot je weekdoel.`;

  return (
    <Reveal stagger className="flex flex-1 flex-col gap-5 px-5 py-7">
      {/* Begroeting */}
      <RevealItem>
        <h1 className="font-display text-2xl font-bold tracking-tight text-neutral-900">
          {greeting(new Date())}, {firstName} 👋
        </h1>
        <p className="mt-1 text-neutral-500">{motivation}</p>
      </RevealItem>

      {/* Weekdoel + streak */}
      <RevealItem className="flex items-center gap-4 rounded-3xl border border-border bg-surface-1 p-5 shadow-sm">
        <ProgressRing
          value={goalPct}
          size={104}
          strokeWidth={10}
          label={`${stats.workoutsThisWeek}/${stats.weeklyGoal}`}
          sublabel="weekdoel"
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">
            Deze week
          </p>
          <p className="mt-0.5 font-display text-lg font-bold leading-tight text-neutral-900">
            {stats.workoutsThisWeek === 0
              ? "Nog niet getraind"
              : `${stats.workoutsThisWeek} ${stats.workoutsThisWeek === 1 ? "training" : "trainingen"}`}
          </p>
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent">
            <Flame className="size-3.5" />
            {stats.currentStreakWeeks > 0
              ? `${stats.currentStreakWeeks} ${stats.currentStreakWeeks === 1 ? "week" : "weken"} streak`
              : "Start je streak"}
          </div>
        </div>
      </RevealItem>

      {/* Quick stats */}
      <RevealItem className="grid grid-cols-3 gap-3">
        <StatCard
          label="Volume"
          value={stats.thisWeekVolume}
          suffix=" kg"
          icon={<Dumbbell className="size-4" />}
          hint="deze week"
        />
        <StatCard
          label="Tijd"
          value={thisWeekMin}
          suffix=" m"
          icon={<Clock className="size-4" />}
          hint="deze week"
        />
        <StatCard
          label="Totaal"
          value={stats.totalWorkouts}
          icon={<Activity className="size-4" />}
          hint="trainingen"
        />
      </RevealItem>

      {/* Schema-hero + CTA */}
      <RevealItem className="panel-sheen relative overflow-hidden rounded-3xl bg-accent-gradient p-6 text-accent-foreground shadow-accent">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-8 -top-10 size-40 rounded-full bg-white/15 blur-2xl"
        />
        <p className="relative text-xs font-medium uppercase tracking-wide opacity-80">
          {openSession ? "Training bezig" : "Jouw schema"}
        </p>
        {schema ? (
          <>
            <p className="relative mt-1 font-display text-2xl font-bold">{schema.name}</p>
            <p className="relative mt-0.5 text-sm opacity-90">
              {schema.items.length} oefeningen
              {schema.days.length > 1 ? ` · ${schema.days.length} dagen` : ""}
            </p>
            <Link
              href={openSession ? "/member/schema/active" : "/member/schema"}
              className="relative mt-4 flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 text-center text-lg font-bold text-[#171717] shadow-md transition-transform active:scale-[0.98]"
            >
              <Play className="size-5 fill-current" />
              {openSession ? "Hervat training" : "Start training"}
            </Link>
          </>
        ) : (
          <p className="relative mt-2 text-sm opacity-90">
            Nog geen schema toegewezen. Vraag je trainer.
          </p>
        )}
      </RevealItem>

      {/* Scan + oefeningen */}
      <RevealItem className="grid grid-cols-2 gap-3">
        <Link
          href="/member/scan"
          className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-surface-1 px-4 py-4 text-center text-sm font-semibold text-neutral-900 shadow-sm transition-colors active:bg-surface-2"
        >
          <QrCode className="size-5 text-accent" /> Scan machine
        </Link>
        <Link
          href="/member/exercises"
          className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-surface-1 px-4 py-4 text-center text-sm font-semibold text-neutral-900 shadow-sm transition-colors active:bg-surface-2"
        >
          <Dumbbell className="size-5 text-accent" /> Oefeningen
        </Link>
      </RevealItem>

      {/* Weekvolume-trend */}
      {stats.totalWorkouts > 0 ? (
        <RevealItem className="rounded-3xl border border-border bg-surface-1 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                Weekvolume
              </p>
              <p className="mt-0.5 font-display text-xl font-bold text-neutral-900">
                laatste 12 weken
              </p>
            </div>
            <Sparkline data={stats.weekVolume.map((w) => w.volume)} width={120} height={40} />
          </div>
        </RevealItem>
      ) : null}

      {/* Spiergroepen */}
      {stats.muscleGroups.length > 0 ? (
        <RevealItem className="rounded-3xl border border-border bg-surface-1 p-5 shadow-sm">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-neutral-400">
            Getrainde spiergroepen · laatste 4 weken
          </p>
          <MuscleGroupBars data={stats.muscleGroups} />
        </RevealItem>
      ) : null}

      {/* Recente PR's */}
      {stats.recentRecords.length > 0 ? (
        <RevealItem className="rounded-3xl border border-border bg-surface-1 p-5 shadow-sm">
          <p className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-neutral-400">
            <Trophy className="size-4 text-accent" /> Recente persoonlijke records
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
            title="Begin je eerste training"
            description="Start je schema en vink je sets af. Je voortgang, records en streak verschijnen hier automatisch."
          />
        </RevealItem>
      ) : null}

      {tenant?.aiEnabled ? (
        <RevealItem>
          <AssistantWidget />
        </RevealItem>
      ) : null}
    </Reveal>
  );
}
