"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { buttonClasses } from "@/components/ui/button";
import { SchemaCover } from "@/components/schema/schema-cover";
import type { SchemaImage } from "@/lib/schema-image";
import {
  importLibraryTemplate,
  libraryTemplatePreview,
  type LibraryTemplatePreview,
} from "../actions";

/** Kaart-samenvatting (server-side berekend uit `LibraryWorkoutTemplate`). */
export type LibraryTemplateCardData = {
  id: string;
  name: string;
  description: string | null;
  goalLabel: string;
  difficultyLabel: string;
  frequencyPerWeek: number | null;
  dayCount: number;
  exerciseCount: number;
  /** Id van de eigen kopie zodra het schema is overgenomen (anders null). */
  importedId: string | null;
  /** Gecureerde omslagfoto (lib/schema-image.ts), server-side opgelost. */
  image: SchemaImage | null;
};

/** "90 sec" / "2 min" / "1 min 30" — compact genoeg voor een oefeningregel. */
function formatRest(seconds: number): string {
  if (seconds < 60) return `${seconds} sec`;
  const min = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0 ? `${min} min` : `${min} min ${rest}`;
}

/**
 * Voorbeeldschema uit de bibliotheek: klikbare kaart die een detailmodal opent
 * met de volledige inhoud (dagen, oefeningen, sets/reps/rust). De inhoud wordt
 * lui geladen via de server-action, precies zoals de oefening-preview op
 * `/owner/exercises`.
 */
export function LibraryTemplateCard({ data }: { data: LibraryTemplateCardData }) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<LibraryTemplatePreview | null>(null);
  const [loading, setLoading] = useState(false);

  function openPreview() {
    setOpen(true);
    if (preview) return; // al geladen: geen tweede rondje
    setLoading(true);
    libraryTemplatePreview(data.id)
      .then((p) => setPreview(p))
      .finally(() => setLoading(false));
  }

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        aria-haspopup="dialog"
        onClick={openPreview}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openPreview();
          }
        }}
        className="group flex cursor-pointer flex-col gap-3 overflow-hidden rounded-2xl border border-border bg-surface-1 pb-4 transition-colors hover:border-border-strong hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <SchemaCover
          image={data.image}
          alt={data.name}
          className="[&_img]:transition-transform [&_img]:duration-300 group-hover:[&_img]:scale-[1.03]"
        />
        <div className="px-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-medium text-neutral-900">{data.name}</h3>
            {data.importedId ? <Badge tone="success">Toegevoegd</Badge> : null}
          </div>
          {data.description ? (
            <p className="mt-1 line-clamp-2 text-xs text-neutral-500">
              {data.description}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-1.5 px-4 text-xs">
          <Badge tone="neutral">{data.goalLabel}</Badge>
          <Badge tone="neutral">{data.difficultyLabel}</Badge>
          {data.frequencyPerWeek ? (
            <Badge tone="neutral">{data.frequencyPerWeek}×/week</Badge>
          ) : null}
        </div>
        <p className="px-4 text-xs text-neutral-400">
          {data.dayCount} {data.dayCount === 1 ? "dag" : "dagen"} ·{" "}
          {data.exerciseCount} oefeningen
        </p>
        <div className="mt-auto flex items-center justify-between gap-2 px-4">
          <span className="text-sm font-medium text-accent">Bekijk voorbeeld →</span>
          {data.importedId ? (
            <Link
              href={`/owner/schemas/templates/${data.importedId}`}
              onClick={(e) => e.stopPropagation()}
              className="text-sm text-neutral-500 hover:text-neutral-900 hover:underline"
            >
              Openen
            </Link>
          ) : (
            <form action={importLibraryTemplate} onClick={(e) => e.stopPropagation()}>
              <input type="hidden" name="libraryTemplateId" value={data.id} />
              <button
                type="submit"
                className="rounded-lg border border-border-strong px-3 py-1.5 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
              >
                Overnemen
              </button>
            </form>
          )}
        </div>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={data.name}
        className="max-w-2xl"
      >
        {loading || !preview ? (
          <div className="flex h-48 items-center justify-center text-sm text-neutral-500">
            {loading ? "Laden…" : "Voorbeeld niet beschikbaar."}
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <SchemaCover
              image={data.image}
              alt={data.name}
              className="-mt-1 rounded-xl"
            />
            {preview.description ? (
              <p className="text-sm text-neutral-600">{preview.description}</p>
            ) : null}

            <div className="flex flex-wrap gap-1.5 text-xs">
              <Badge tone="neutral">{data.goalLabel}</Badge>
              <Badge tone="neutral">{data.difficultyLabel}</Badge>
              {preview.frequencyPerWeek ? (
                <Badge tone="neutral">{preview.frequencyPerWeek}×/week</Badge>
              ) : null}
              <Badge tone="neutral">
                {preview.days.length} {preview.days.length === 1 ? "dag" : "dagen"}
              </Badge>
              <Badge tone="neutral">{preview.exerciseCount} oefeningen</Badge>
            </div>

            {preview.days.map((day, i) => (
              <section key={i} className="flex flex-col gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  {day.name}
                </h3>
                <ul className="flex flex-col divide-y divide-neutral-100 rounded-xl border border-border">
                  {day.exercises.map((ex, j) => (
                    <li key={j} className="flex items-center gap-3 px-3 py-2">
                      <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-neutral-50">
                        {ex.thumbUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={ex.thumbUrl}
                            alt=""
                            loading="lazy"
                            className="size-full object-contain"
                          />
                        ) : null}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-medium text-neutral-900">
                            {ex.name}
                          </span>
                          {!ex.inGym ? <Badge tone="accent">Nieuw</Badge> : null}
                        </div>
                        {ex.notes ? (
                          <p className="truncate text-xs text-neutral-500">{ex.notes}</p>
                        ) : null}
                      </div>
                      <span className="shrink-0 text-right text-xs text-neutral-500">
                        {[
                          ex.sets && ex.reps
                            ? `${ex.sets} × ${ex.reps}`
                            : (ex.reps ?? (ex.sets ? `${ex.sets} sets` : null)),
                          ex.restSeconds ? `${formatRest(ex.restSeconds)} rust` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </li>
                  ))}
                  {day.exercises.length === 0 ? (
                    <li className="px-3 py-4 text-center text-xs text-neutral-400">
                      Rustdag
                    </li>
                  ) : null}
                </ul>
              </section>
            ))}

            <div className="flex flex-col gap-2">
              {data.importedId ? (
                <Link
                  href={`/owner/schemas/templates/${data.importedId}`}
                  className={buttonClasses({ size: "sm", className: "w-full" })}
                >
                  Open mijn kopie
                </Link>
              ) : (
                <>
                  {preview.newExerciseCount > 0 ? (
                    <p className="text-xs text-neutral-500">
                      Overnemen maakt een eigen kopie die je vrij kunt bewerken.{" "}
                      {preview.newExerciseCount}{" "}
                      {preview.newExerciseCount === 1
                        ? "oefening wordt"
                        : "oefeningen worden"}{" "}
                      aan je sportschool toegevoegd.
                    </p>
                  ) : null}
                  <form action={importLibraryTemplate}>
                    <input type="hidden" name="libraryTemplateId" value={data.id} />
                    <button
                      type="submit"
                      className={buttonClasses({ size: "sm", className: "w-full" })}
                    >
                      Kopieer naar mijn schema&apos;s
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
