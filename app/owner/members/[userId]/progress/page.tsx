import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireOwner } from "@/lib/owner";
import { buttonClasses } from "@/components/ui/button-classes";
import { MemberProfileTabs } from "@/components/members/profile-tabs";
import { ProgressDeltas } from "@/components/progress/progress-deltas";
import { MeasurementCharts } from "@/components/progress/measurement-charts";
import { GoalsPanel } from "@/components/progress/goals-panel";
import { MeasurementTimeline } from "@/components/progress/measurement-timeline";
import { PhotoCompare } from "@/components/progress/photo-compare";
import { listMeasurements, getDeltas, getSeries, getGoals } from "@/lib/measurements";
import { GOAL_METRICS, GOAL_METRIC_LABEL } from "@/lib/measurement-meta";
import { setGoal, deleteGoal } from "./actions";

const DATE_FMT = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short", year: "numeric" });

async function loadMember(tenantId: string, userId: string) {
  return prisma.user.findFirst({
    where: { id: userId, tenantId, role: "TENANT_MEMBER" },
    select: { id: true, name: true, email: true },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ userId: string }>;
}): Promise<Metadata> {
  const owner = await requireOwner();
  const { userId } = await params;
  const member = await loadMember(owner.tenantId, userId);
  const label = member?.name ?? member?.email ?? "Lid";
  return { title: `${label} | Voortgang` };
}

export default async function MemberProgressPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const owner = await requireOwner();
  const { userId } = await params;
  const member = await loadMember(owner.tenantId, userId);
  if (!member) notFound();

  const [rows, deltas, series, goals] = await Promise.all([
    listMeasurements(owner.tenantId, userId),
    getDeltas(owner.tenantId, userId),
    getSeries(owner.tenantId, userId, "all"),
    getGoals(owner.tenantId, userId),
  ]);

  const label = member.name ?? member.email;
  const compare = rows.map((r) => ({
    id: r.id,
    label: DATE_FMT.format(new Date(r.measuredAt)),
    photos: r.photos.map((p) => ({ pose: p.pose, url: p.url })),
  }));
  const baseHref = `/owner/members/${userId}/progress`;

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <div>
        <Link href="/owner/members" className="text-sm text-neutral-500 hover:text-neutral-900">
          ← Leden
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900">{label}</h1>
        <p className="mt-1 text-sm text-neutral-500">Voortgang & lichaamsmetingen</p>
      </div>

      <MemberProfileTabs userId={userId} active="progress" />

      <div className="flex flex-wrap gap-2">
        <Link href={`${baseHref}/new`} className={buttonClasses({ size: "md" })}>
          + Nieuwe meting
        </Link>
        {rows.length > 0 ? (
          <a href={`${baseHref}/pdf`} className={buttonClasses({ variant: "outline", size: "md" })}>
            Rapport (PDF)
          </a>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface-0 p-10 text-center">
          <p className="text-3xl">📏</p>
          <p className="mt-2 font-semibold text-neutral-900">Nog geen metingen</p>
          <p className="mt-1 text-sm text-neutral-500">
            Leg de eerste lichaamsmeting vast om de voortgang te volgen.
          </p>
          <Link
            href={`${baseHref}/new`}
            className={buttonClasses({ size: "md", className: "mt-4" })}
          >
            + Eerste meting
          </Link>
        </div>
      ) : (
        <>
          <ProgressDeltas deltas={deltas} />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <MeasurementCharts points={series} />
            </div>
            <div className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-neutral-900">Doelen</h2>
              <GoalsPanel goals={goals} />
              <GoalEditor userId={userId} goals={goals.map((g) => ({ id: g.id, label: GOAL_METRIC_LABEL[g.metric] }))} />
            </div>
          </div>

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-neutral-900">Foto-vergelijking</h2>
            <PhotoCompare measurements={compare} />
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-neutral-900">Meetgeschiedenis</h2>
            <MeasurementTimeline rows={rows} hrefBase={baseHref} />
          </section>
        </>
      )}
    </div>
  );
}

/** Trainer-only doelenbeheer (toevoegen + verwijderen). */
function GoalEditor({
  userId,
  goals,
}: {
  userId: string;
  goals: { id: string; label: string }[];
}) {
  return (
    <details className="rounded-2xl border border-border bg-surface-1 p-4">
      <summary className="cursor-pointer text-sm font-medium text-neutral-700">
        Doelen beheren
      </summary>
      <div className="mt-3 flex flex-col gap-3">
        <form action={setGoal} className="flex flex-col gap-2">
          <input type="hidden" name="userId" value={userId} />
          <div className="grid grid-cols-2 gap-2">
            <select
              name="metric"
              className="rounded-lg border border-border bg-surface-0 px-2 py-1.5 text-sm"
            >
              {GOAL_METRICS.map((m) => (
                <option key={m} value={m}>{GOAL_METRIC_LABEL[m]}</option>
              ))}
            </select>
            <input
              type="number"
              name="targetValue"
              step={0.1}
              min={0}
              required
              placeholder="Doelwaarde"
              className="rounded-lg border border-border bg-surface-0 px-2 py-1.5 text-sm"
            />
          </div>
          <input
            type="date"
            name="targetDate"
            className="rounded-lg border border-border bg-surface-0 px-2 py-1.5 text-sm"
          />
          <button type="submit" className={buttonClasses({ variant: "secondary", size: "sm" })}>
            Doel toevoegen
          </button>
        </form>

        {goals.length > 0 ? (
          <ul className="flex flex-col gap-1.5 border-t border-border pt-3">
            {goals.map((g) => (
              <li key={g.id} className="flex items-center justify-between text-sm">
                <span className="text-neutral-700">{g.label}</span>
                <form action={deleteGoal}>
                  <input type="hidden" name="userId" value={userId} />
                  <input type="hidden" name="goalId" value={g.id} />
                  <button type="submit" className="text-xs text-neutral-400 hover:text-red-600">
                    Verwijderen
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </details>
  );
}
