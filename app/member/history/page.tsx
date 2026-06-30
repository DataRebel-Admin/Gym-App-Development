import Link from "next/link";
import { requireMember, getMemberHistory } from "@/lib/member";
import { getMemberStats, getRecentSessions } from "@/lib/member-stats";
import { HistoryChart } from "./history-chart";
import { Reveal, RevealItem } from "@/components/motion/reveal";
import { StatCard } from "@/components/ui/stat-card";
import { TrainingHeatmap } from "@/components/charts/training-heatmap";
import { MiniBarChart } from "@/components/charts/mini-bar-chart";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Activity,
  Flame,
  Dumbbell,
  Clock,
  Trophy,
  ChevronRight,
} from "@/components/ui/icons";

const DATE_FMT = new Intl.DateTimeFormat("nl-NL", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

export const metadata = { title: "Geschiedenis" };

function fmtDuration(sec: number) {
  const m = Math.round(sec / 60);
  return m >= 60 ? `${Math.floor(m / 60)}u ${m % 60}m` : `${m}m`;
}

export default async function MemberHistoryPage() {
  const member = await requireMember();
  const [{ series }, stats, sessions] = await Promise.all([
    getMemberHistory(member.id, member.tenantId),
    getMemberStats(member.id, member.tenantId),
    getRecentSessions(member.id, member.tenantId, 20),
  ]);

  const totalHours = Math.round((stats.totalDurationSec / 3600) * 10) / 10;
  const hasActivity = stats.totalWorkouts > 0;

  return (
    <Reveal stagger className="flex flex-1 flex-col gap-6 px-5 py-8">
      <RevealItem>
        <h1 className="font-display text-2xl font-bold tracking-tight text-neutral-900">
          Historie
        </h1>
        <p className="mt-1 text-sm text-neutral-500">Jouw voortgang in cijfers.</p>
      </RevealItem>

      {!hasActivity ? (
        <RevealItem>
          <EmptyState
            icon={<Activity className="size-7 text-accent" />}
            title="Nog geen trainingen"
            description="Zodra je je eerste training logt, verschijnen hier je records, streak en voortgangsgrafieken."
            action={
              <Link
                href="/member/schema"
                className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground active:opacity-90"
              >
                Start training
              </Link>
            }
          />
        </RevealItem>
      ) : (
        <>
          {/* KPI's */}
          <RevealItem className="grid grid-cols-2 gap-3">
            <StatCard label="Trainingen" value={stats.totalWorkouts} icon={<Activity className="size-4" />} hint="totaal" />
            <StatCard label="Streak" value={stats.currentStreakWeeks} suffix=" wk" icon={<Flame className="size-4" />} hint={`langste ${stats.longestStreakWeeks} wk`} />
            <StatCard label="Volume" value={stats.totalVolume} suffix=" kg" icon={<Dumbbell className="size-4" />} hint="totaal getild" />
            <StatCard label="Trainingstijd" value={totalHours} suffix=" u" icon={<Clock className="size-4" />} hint="totaal" />
          </RevealItem>

          {/* Consistentie-heatmap */}
          <RevealItem className="rounded-3xl border border-border bg-surface-1 p-5 shadow-sm">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-neutral-400">
              Consistentie · laatste 16 weken
            </p>
            <TrainingHeatmap days={stats.heatmap} />
          </RevealItem>

          {/* Weekvolume */}
          <RevealItem className="rounded-3xl border border-border bg-surface-1 p-5 shadow-sm">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-neutral-400">
              Weekvolume · laatste 12 weken
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
                <Trophy className="size-4 text-accent" /> Persoonlijke records
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
                Gewichtsprogressie per oefening
              </p>
              <HistoryChart series={series} />
            </RevealItem>
          ) : null}

          {/* Eerdere sessies als kaarten */}
          <RevealItem className="flex flex-col gap-3">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">
              Eerdere sessies
            </p>
            {sessions.length === 0 ? (
              <p className="text-sm text-neutral-500">Nog geen afgeronde sessies.</p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {sessions.map((s) => (
                  <li
                    key={s.id}
                    className="rounded-2xl border border-border bg-surface-1 p-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-display font-bold capitalize text-neutral-900">
                        {DATE_FMT.format(s.startedAt)}
                      </span>
                      <span className="text-xs text-neutral-500">
                        {s.exerciseCount} oef · {fmtDuration(s.durationSec)}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-4 text-sm text-neutral-600">
                      <span className="inline-flex items-center gap-1">
                        <Dumbbell className="size-3.5 text-accent" />
                        {s.totalVolume.toLocaleString("nl-NL")} kg
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Activity className="size-3.5 text-accent" />
                        {s.totalSets} sets
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
