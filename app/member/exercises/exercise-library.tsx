"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { EmptyState } from "@/components/ui/empty-state";
import { Dumbbell, Search, ChevronRight, X } from "@/components/ui/icons";

export type LibraryExercise = {
  id: string;
  name: string;
  thumbUrl: string | null;
  muscle: string | null;
  bodyPart: string | null;
  equipment: string | null;
};

/**
 * Doorzoekbare oefeningenbibliotheek voor leden. Toont de gecureerde oefeningen
 * van de eigen sportschool met thumbnail + spiergroep; tikken opent de
 * detailpagina met animatie, stappenplan en uitleg. Filteren op lichaamsdeel
 * en vrije tekst — client-side (gecureerde set is klein).
 */
export function ExerciseLibrary({ exercises }: { exercises: LibraryExercise[] }) {
  const [query, setQuery] = useState("");
  const [bodyPart, setBodyPart] = useState<string | null>(null);

  const bodyParts = useMemo(() => {
    const set = new Set<string>();
    for (const e of exercises) if (e.bodyPart) set.add(e.bodyPart);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [exercises]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exercises.filter((e) => {
      if (bodyPart && e.bodyPart !== bodyPart) return false;
      if (!q) return true;
      return (
        e.name.toLowerCase().includes(q) ||
        (e.muscle?.toLowerCase().includes(q) ?? false) ||
        (e.equipment?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [exercises, query, bodyPart]);

  return (
    <div className="flex flex-1 flex-col gap-4 px-5 py-7">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-neutral-900">
          Oefeningen
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Bekijk uitleg, animaties en stappenplan van elke oefening in jouw sportschool.
        </p>
      </div>

      {/* Zoeken */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Zoek op naam, spier of materiaal…"
          className="w-full rounded-2xl border border-border bg-surface-1 py-3 pl-10 pr-10 text-sm text-neutral-900 outline-none focus:border-accent"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Wissen"
            className="absolute right-3 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-neutral-400 hover:text-neutral-700"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>

      {/* Filter op lichaamsdeel */}
      {bodyParts.length > 0 ? (
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Chip active={bodyPart === null} onClick={() => setBodyPart(null)}>
            Alles
          </Chip>
          {bodyParts.map((bp) => (
            <Chip key={bp} active={bodyPart === bp} onClick={() => setBodyPart(bp)}>
              {bp}
            </Chip>
          ))}
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Dumbbell className="size-7 text-accent" />}
          title="Geen oefeningen gevonden"
          description={
            exercises.length === 0
              ? "Je sportschool heeft nog geen oefeningen toegevoegd."
              : "Pas je zoekopdracht of filter aan."
          }
        />
      ) : (
        <ul className="grid grid-cols-2 gap-3">
          {filtered.map((e) => (
            <li key={e.id}>
              <Link
                href={`/member/history/exercise/${e.id}`}
                className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface-1 shadow-sm transition-transform active:scale-[0.98]"
              >
                <div className="aspect-square w-full overflow-hidden bg-surface-2">
                  {e.thumbUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={e.thumbUrl}
                      alt=""
                      aria-hidden
                      loading="lazy"
                      className="size-full object-cover"
                    />
                  ) : (
                    <span className="flex size-full items-center justify-center text-accent">
                      <Dumbbell className="size-9" />
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-3">
                  <p className="line-clamp-2 text-sm font-semibold capitalize leading-tight text-neutral-900">
                    {e.name}
                  </p>
                  {e.muscle ? (
                    <p className="mt-1 truncate text-xs capitalize text-neutral-500">
                      {e.muscle}
                    </p>
                  ) : null}
                  <span className="mt-2 inline-flex items-center gap-0.5 text-xs font-medium text-accent">
                    Bekijk <ChevronRight className="size-3.5" />
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-medium capitalize transition-colors",
        active
          ? "border-accent bg-accent text-accent-foreground"
          : "border-border bg-surface-1 text-neutral-600 hover:bg-surface-2"
      )}
    >
      {children}
    </button>
  );
}
