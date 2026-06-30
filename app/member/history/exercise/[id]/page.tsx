import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMember, getExerciseProgress } from "@/lib/member";
import { getExerciseDetail } from "@/lib/exercise";
import { getCurrentTenant } from "@/lib/tenant";
import { ProgressLineChart } from "@/components/charts/progress-line-chart";

const DATE_FMT = new Intl.DateTimeFormat("nl-NL", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

const LANG_LABEL: Record<string, string> = {
  en: "Engels",
  es: "Spaans",
  it: "Italiaans",
  tr: "Turks",
  nl: "Nederlands",
};

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
  const progress = await getExerciseProgress(member.id, member.tenantId, id);
  if (!progress) notFound();

  const detail = await getExerciseDetail(id, member.tenantId, tenant?.locale ?? "NL");
  const muscles = detail
    ? [detail.primaryMuscle, ...detail.secondaryMuscles].filter(
        (m): m is string => Boolean(m)
      )
    : [];
  // Toon een taalnotitie wanneer de instructie niet in het Nederlands is.
  const showLangNote =
    detail?.instructionLang && detail.instructionLang !== "nl";

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
          {detail?.name ?? progress.name}
        </h1>
        {detail?.equipment || detail?.bodyPart ? (
          <p className="mt-1 text-sm text-neutral-500">
            {[detail?.bodyPart, detail?.equipment].filter(Boolean).join(" · ")}
          </p>
        ) : null}
      </div>

      {detail?.gifUrl || detail?.imageUrl ? (
        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={detail.gifUrl ?? detail.imageUrl ?? ""}
            alt={detail.name}
            className="h-64 w-full object-contain"
          />
        </div>
      ) : null}

      {muscles.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {muscles.map((m, i) => (
            <span
              key={`${m}-${i}`}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                i === 0
                  ? "bg-accent/10 text-accent"
                  : "bg-neutral-100 text-neutral-600"
              }`}
            >
              {m}
            </span>
          ))}
        </div>
      ) : null}

      {detail && (detail.steps.length > 0 || detail.instructionsText) ? (
        <section className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-neutral-900">Uitvoering</h2>
            {showLangNote ? (
              <span className="text-xs text-neutral-400">
                in het {LANG_LABEL[detail.instructionLang!] ?? detail.instructionLang}
              </span>
            ) : null}
          </div>
          {detail.steps.length > 0 ? (
            <ol className="flex flex-col gap-2">
              {detail.steps.map((step, i) => (
                <li key={i} className="flex gap-3 text-sm text-neutral-700">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-semibold text-neutral-500">
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-neutral-700">{detail.instructionsText}</p>
          )}
        </section>
      ) : null}

      {/* Verplichte veiligheidsmelding — ALTIJD zichtbaar (ontwerpprincipe #2). */}
      <div className="rounded-xl border-2 border-accent bg-accent/5 px-5 py-4 text-center">
        <p className="font-semibold text-neutral-900">
          Twijfel? Raadpleeg een professional.
        </p>
        <p className="mt-1 text-sm text-neutral-600">
          Bij pijn of onzekerheid over de uitvoering: vraag altijd een trainer.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-neutral-900">Voortgang</h2>
        {progress.points.length > 0 ? (
          <ProgressLineChart data={progress.points} />
        ) : (
          <p className="text-sm text-neutral-500">
            Nog geen data voor deze oefening.
          </p>
        )}
      </section>

      {progress.sessions.length > 0 ? (
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
      ) : null}
    </div>
  );
}
