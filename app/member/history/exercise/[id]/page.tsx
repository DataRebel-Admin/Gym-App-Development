import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireMember, getExerciseProgress } from "@/lib/member";
import { getExerciseDetail, getAlternativeExercises } from "@/lib/exercise";
import { getCurrentTenant } from "@/lib/tenant";
import { ProgressLineChart } from "@/components/charts/progress-line-chart";
import { ExerciseDetailView } from "@/components/member/exercise-detail-view";
import { BackButton } from "@/components/member/back-button";
import { TrendingUp } from "@/components/ui/icons";

const DATE_FMT = new Intl.DateTimeFormat("nl-NL", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const tenant = await getCurrentTenant();
  const detail = tenant
    ? await getExerciseDetail(id, tenant.id, tenant.locale ?? "NL")
    : null;
  return { title: detail ? `${detail.name} | Oefening` : "Oefening" };
}

export default async function ExerciseProgressPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const member = await requireMember();
  const tenant = await getCurrentTenant();
  const [progress, detail, alternatives] = await Promise.all([
    getExerciseProgress(member.id, member.tenantId, id),
    getExerciseDetail(id, member.tenantId, tenant?.locale ?? "NL"),
    getAlternativeExercises(member.tenantId, id),
  ]);
  if (!progress) notFound();

  // Val terug op de progressie-naam wanneer de catalogus geen detail levert.
  const resolved =
    detail ??
    ({
      id,
      name: progress.name,
      description: null,
      imageUrl: null,
      gifUrl: null,
      images: [],
      videoUrl: null,
      steps: [],
      instructionsText: null,
      executionMd: null,
      coachingTipsMd: null,
      commonMistakesMd: null,
      notesMd: null,
      tags: [],
      primaryMuscle: null,
      secondaryMuscles: [],
      equipment: null,
      bodyPart: null,
      category: null,
      difficulty: "Gemiddeld" as const,
      instructionLang: null,
      fromCatalog: false,
      source: "standaard" as const,
    });

  const progressSlot = (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-neutral-900">
        <TrendingUp className="size-4 text-accent" /> Jouw voortgang
      </h2>
      {progress.points.length > 0 ? (
        <div className="rounded-3xl border border-border bg-surface-1 p-4 shadow-sm">
          <ProgressLineChart data={progress.points} />
        </div>
      ) : (
        <p className="text-sm text-neutral-500">Nog geen gewichtsdata voor deze oefening.</p>
      )}

      {progress.sessions.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-2">
          {progress.sessions.map((s, i) => (
            <li
              key={i}
              className="flex items-center justify-between rounded-2xl border border-border bg-surface-1 px-4 py-3 text-sm shadow-sm"
            >
              <span className="font-medium capitalize text-neutral-900">
                {DATE_FMT.format(s.date)}
              </span>
              <span className="text-neutral-500">
                {s.maxWeight} kg · {s.sets} sets
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );

  return (
    <div className="flex flex-1 flex-col gap-5 px-5 py-6">
      <BackButton fallback="/member/exercises" />
      <ExerciseDetailView
        detail={resolved}
        alternatives={alternatives}
        progressSlot={progressSlot}
      />
    </div>
  );
}
