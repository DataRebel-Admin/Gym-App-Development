import Link from "next/link";
import Markdown from "react-markdown";
import type { ExerciseDetail, ExerciseAlternative } from "@/lib/exercise";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { toEmbedUrl } from "@/lib/video";
import { Dumbbell, Target, MapPin, Activity, ChevronRight, Sparkles } from "@/components/ui/icons";

const PROSE =
  "prose prose-sm prose-neutral max-w-none text-neutral-700 [&_h2]:mt-0 [&_h2]:text-base [&_h2]:font-semibold [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5";

/** Sectie met een Markdown-body (eigen-oefening rich text). */
function MarkdownSection({ title, body }: { title: string; body: string }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-neutral-900">{title}</h2>
      <div className={PROSE}>
        <Markdown>{body}</Markdown>
      </div>
    </section>
  );
}

const LANG_LABEL: Record<string, string> = {
  en: "Engels",
  es: "Spaans",
  it: "Italiaans",
  tr: "Turks",
  nl: "Nederlands",
};

const DIFFICULTY_TONE: Record<string, BadgeTone> = {
  Beginner: "success",
  Gemiddeld: "warning",
  Gevorderd: "danger",
};

/** Algemene techniek-tips (generiek — niet per oefening; veiligheidsmelding blijft leidend). */
const GENERAL_TIPS = [
  "Warm op met een paar lichtere sets voordat je zwaar gaat.",
  "Beweeg gecontroleerd — vermijd zwiepen of momentum.",
  "Houd je core aangespannen en je rug in een neutrale houding.",
  "Adem uit tijdens de inspanning, adem in bij het zakken.",
];

function InfoCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-2xl border border-border bg-surface-1 p-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">
          {label}
        </p>
        <p className="truncate text-sm font-semibold capitalize text-neutral-900">
          {value}
        </p>
      </div>
    </div>
  );
}

/**
 * Premium, herbruikbare weergave van één oefening: hero-media, info-kaarten
 * (spiergroep/materiaal/lichaamsdeel/niveau), spiergroep-chips, genummerd
 * stappenplan, algemene tips, data-gedekte alternatieven en de verplichte
 * veiligheidsmelding. `progressSlot` injecteert (optioneel) de voortgangssectie.
 */
export function ExerciseDetailView({
  detail,
  alternatives,
  progressSlot,
  assistantSlot,
}: {
  detail: ExerciseDetail;
  alternatives: ExerciseAlternative[];
  progressSlot?: React.ReactNode;
  /** Optionele contextbewuste AI-assistent (uitleg/alternatieven/techniek). */
  assistantSlot?: React.ReactNode;
}) {
  const muscles = [detail.primaryMuscle, ...detail.secondaryMuscles].filter(
    (m): m is string => Boolean(m)
  );
  const showLangNote = detail.instructionLang && detail.instructionLang !== "nl";
  const media = detail.gifUrl ?? detail.imageUrl;
  const extraImages = detail.images.filter((img) => img !== media);
  const video = toEmbedUrl(detail.videoUrl);
  const hasExecution =
    detail.steps.length > 0 || detail.instructionsText || detail.executionMd;

  return (
    <div className="flex flex-col gap-6">
      {/* Hero */}
      {media ? (
        <div className="overflow-hidden rounded-3xl border border-border bg-surface-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={media}
            alt={detail.name}
            className="h-64 w-full object-contain"
          />
        </div>
      ) : (
        <div className="flex h-44 w-full items-center justify-center rounded-3xl bg-accent-soft text-accent">
          <Dumbbell className="size-12" />
        </div>
      )}

      {/* Extra afbeeldingen (eigen oefeningen kunnen er meerdere hebben) */}
      {extraImages.length > 0 ? (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {extraImages.map((img) => (
            <div
              key={img}
              className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-border bg-surface-2"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img} alt="" aria-hidden className="h-full w-full object-cover" />
            </div>
          ))}
        </div>
      ) : null}

      {/* Video (YouTube/Vimeo) */}
      {video ? (
        <div className="overflow-hidden rounded-3xl border border-border bg-black">
          <div className="relative aspect-video w-full">
            <iframe
              src={video.embedUrl}
              title={`Video — ${detail.name}`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 h-full w-full"
            />
          </div>
        </div>
      ) : detail.videoUrl ? (
        <a
          href={detail.videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
        >
          Bekijk video <ChevronRight className="size-3.5" />
        </a>
      ) : null}

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={DIFFICULTY_TONE[detail.difficulty] ?? "neutral"}>
            {detail.difficulty}
          </Badge>
          {detail.category ? (
            <Badge tone="neutral" className="capitalize">
              {detail.category}
            </Badge>
          ) : null}
        </div>
        <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-neutral-900">
          {detail.name}
        </h1>
        {detail.description ? (
          <p className="mt-1 text-sm text-neutral-500">{detail.description}</p>
        ) : null}
      </div>

      {/* Info-kaarten */}
      <div className="grid grid-cols-2 gap-3">
        {detail.primaryMuscle ? (
          <InfoCard icon={<Target className="size-4" />} label="Spiergroep" value={detail.primaryMuscle} />
        ) : null}
        {detail.equipment ? (
          <InfoCard icon={<Dumbbell className="size-4" />} label="Materiaal" value={detail.equipment} />
        ) : null}
        {detail.bodyPart ? (
          <InfoCard icon={<MapPin className="size-4" />} label="Lichaamsdeel" value={detail.bodyPart} />
        ) : null}
        <InfoCard icon={<Activity className="size-4" />} label="Niveau" value={detail.difficulty} />
      </div>

      {/* Spiergroep-chips */}
      {muscles.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-400">
            Getrainde spieren
          </p>
          <div className="flex flex-wrap gap-2">
            {muscles.map((m, i) => (
              <span
                key={`${m}-${i}`}
                className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
                  i === 0 ? "bg-accent-soft text-accent" : "bg-surface-2 text-neutral-600"
                }`}
              >
                {m}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {/* Uitvoering */}
      {hasExecution ? (
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-neutral-900">Uitvoering</h2>
            {showLangNote ? (
              <span className="text-xs text-neutral-400">
                in het {LANG_LABEL[detail.instructionLang!] ?? detail.instructionLang}
              </span>
            ) : null}
          </div>
          {detail.steps.length > 0 ? (
            <ol className="flex flex-col gap-2.5">
              {detail.steps.map((step, i) => (
                <li
                  key={i}
                  className="flex gap-3 rounded-2xl border border-border bg-surface-1 p-3 text-sm text-neutral-700"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          ) : detail.executionMd ? (
            <div className={PROSE}>
              <Markdown>{detail.executionMd}</Markdown>
            </div>
          ) : (
            <p className="text-sm text-neutral-700">{detail.instructionsText}</p>
          )}
        </section>
      ) : null}

      {/* Coachingtips: eigen tekst indien aanwezig, anders generieke tips */}
      {detail.coachingTipsMd ? (
        <section className="rounded-3xl border border-border bg-surface-1 p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-neutral-900">
            <Sparkles className="size-4 text-accent" /> Coachingtips
          </h2>
          <div className={PROSE}>
            <Markdown>{detail.coachingTipsMd}</Markdown>
          </div>
        </section>
      ) : (
        <section className="rounded-3xl border border-border bg-surface-1 p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-neutral-900">
            <Sparkles className="size-4 text-accent" /> Algemene tips
          </h2>
          <ul className="flex flex-col gap-2">
            {GENERAL_TIPS.map((tip, i) => (
              <li key={i} className="flex gap-2 text-sm text-neutral-600">
                <span className="text-accent">•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Veelgemaakte fouten (eigen oefening) */}
      {detail.commonMistakesMd ? (
        <MarkdownSection title="Veelgemaakte fouten" body={detail.commonMistakesMd} />
      ) : null}

      {/* Opmerkingen (eigen oefening) */}
      {detail.notesMd ? (
        <MarkdownSection title="Opmerkingen" body={detail.notesMd} />
      ) : null}

      {/* Verplichte veiligheidsmelding — ALTIJD zichtbaar (ontwerpprincipe #2). */}
      <div className="rounded-2xl border-2 border-accent bg-accent-soft px-5 py-4 text-center">
        <p className="font-semibold text-neutral-900">Twijfel? Raadpleeg een professional.</p>
        <p className="mt-1 text-sm text-neutral-600">
          Bij pijn of onzekerheid over de uitvoering: vraag altijd een trainer.
        </p>
      </div>

      {/* AI-assistent (optioneel, contextbewust: uitleg/alternatieven/techniek) */}
      {assistantSlot}

      {/* Voortgang (optioneel) */}
      {progressSlot}

      {/* Alternatieven */}
      {alternatives.length > 0 ? (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-neutral-900">
            Alternatieve oefeningen
          </h2>
          <ul className="flex flex-col gap-2">
            {alternatives.map((alt) => (
              <li key={alt.id}>
                <Link
                  href={`/member/history/exercise/${alt.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-surface-1 p-2.5 shadow-sm active:bg-surface-2"
                >
                  {alt.thumbUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={alt.thumbUrl}
                      alt=""
                      aria-hidden
                      loading="lazy"
                      className="h-12 w-12 shrink-0 rounded-xl object-cover"
                    />
                  ) : (
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                      <Dumbbell className="size-5" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium capitalize text-neutral-900">
                      {alt.name}
                    </span>
                    {alt.equipment ? (
                      <span className="block truncate text-xs capitalize text-neutral-500">
                        {alt.equipment}
                      </span>
                    ) : null}
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-neutral-300" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
