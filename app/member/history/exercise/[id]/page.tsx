import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMember, getExerciseProgress } from "@/lib/member";
import { ProgressLineChart } from "@/components/charts/progress-line-chart";

const DATE_FMT = new Intl.DateTimeFormat("nl-NL", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

export default async function ExerciseProgressPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const member = await requireMember();
  const progress = await getExerciseProgress(member.id, member.tenantId, id);
  if (!progress) notFound();

  return (
    <div className="flex flex-1 flex-col gap-6 px-5 py-8">
      <div>
        <Link
          href="/member/history"
          className="text-sm text-neutral-500 hover:text-neutral-900"
        >
          ← Historie
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900">
          {progress.name}
        </h1>
      </div>

      {progress.points.length > 0 ? (
        <ProgressLineChart data={progress.points} />
      ) : (
        <p className="text-sm text-neutral-500">Nog geen data voor deze oefening.</p>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-neutral-900">
          Laatste sessies
        </h2>
        <ul className="flex flex-col gap-2">
          {progress.sessions.map((s, i) => (
            <li
              key={i}
              className="flex items-center justify-between rounded-xl border border-neutral-200 px-4 py-3 text-sm"
            >
              <span className="font-medium text-neutral-900">
                {DATE_FMT.format(s.date)}
              </span>
              <span className="text-neutral-500">
                {s.maxWeight} kg · {s.sets} sets
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
