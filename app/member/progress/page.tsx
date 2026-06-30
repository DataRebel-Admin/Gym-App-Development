import { requireMember } from "@/lib/member";
import { listMeasurements, getDeltas, getSeries, getGoals } from "@/lib/measurements";
import { ProgressDeltas } from "@/components/progress/progress-deltas";
import { MeasurementCharts } from "@/components/progress/measurement-charts";
import { GoalsPanel } from "@/components/progress/goals-panel";
import { MeasurementTimeline } from "@/components/progress/measurement-timeline";
import { PhotoCompare } from "@/components/progress/photo-compare";

export const metadata = { title: "Mijn voortgang" };

const DATE_FMT = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short", year: "numeric" });

export default async function MemberProgressPage() {
  const member = await requireMember();

  const [rows, deltas, series, goals] = await Promise.all([
    listMeasurements(member.tenantId, member.id),
    getDeltas(member.tenantId, member.id),
    getSeries(member.tenantId, member.id, "all"),
    getGoals(member.tenantId, member.id),
  ]);

  const compare = rows.map((r) => ({
    id: r.id,
    label: DATE_FMT.format(new Date(r.measuredAt)),
    photos: r.photos.map((p) => ({ pose: p.pose, url: p.url })),
  }));

  return (
    <div className="flex flex-col gap-6 px-4 py-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-neutral-900">Mijn voortgang</h1>
        <p className="mt-1 text-sm text-neutral-500">Je lichaamsmetingen en ontwikkeling.</p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface-0 p-8 text-center">
          <p className="text-3xl">📏</p>
          <p className="mt-2 font-semibold text-neutral-900">Nog geen metingen</p>
          <p className="mt-1 text-sm text-neutral-500">
            Je trainer legt je lichaamsmetingen vast — ze verschijnen hier zodra dat gebeurt.
          </p>
        </div>
      ) : (
        <>
          <ProgressDeltas deltas={deltas} />
          <MeasurementCharts points={series} />

          {goals.length > 0 ? (
            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-neutral-900">Mijn doelen</h2>
              <GoalsPanel goals={goals} />
            </section>
          ) : null}

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-neutral-900">Foto-vergelijking</h2>
            <PhotoCompare measurements={compare} />
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-neutral-900">Meetgeschiedenis</h2>
            <MeasurementTimeline rows={rows} hrefBase="/member/progress" />
          </section>
        </>
      )}
    </div>
  );
}
