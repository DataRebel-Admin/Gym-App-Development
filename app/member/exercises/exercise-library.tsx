"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { EmptyState } from "@/components/ui/empty-state";
import { Dumbbell, Search, ChevronRight, X, Star } from "@/components/ui/icons";
import { toggleFavoriteExercise } from "./actions";

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
export function ExerciseLibrary({
  exercises,
  initialFavorites,
}: {
  exercises: LibraryExercise[];
  initialFavorites: string[];
}) {
  const t = useTranslations("member.exercises");
  const [query, setQuery] = useState("");
  const [bodyPart, setBodyPart] = useState<string | null>(null);
  const [favOnly, setFavOnly] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set(initialFavorites));
  const [, startFav] = useTransition();

  function toggleFavorite(id: string) {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    startFav(() => void toggleFavoriteExercise({ exerciseId: id }));
  }

  const bodyParts = useMemo(() => {
    const set = new Set<string>();
    for (const e of exercises) if (e.bodyPart) set.add(e.bodyPart);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [exercises]);

  // Bevroren snapshot van de favorieten voor de "favorieten-bovenaan"-sortering.
  // We verversen 'm alléén als de zoek/filter-weergave verandert — niet bij een
  // toggle — zodat een net-aangetikte favoriet niet meteen naar boven springt en
  // de lijst niet onder je vinger wegscrolt.
  const sortFavorites = useMemo(
    () => new Set(favorites),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query, bodyPart, favOnly]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = exercises.filter((e) => {
      if (favOnly && !favorites.has(e.id)) return false;
      if (bodyPart && e.bodyPart !== bodyPart) return false;
      if (!q) return true;
      return (
        e.name.toLowerCase().includes(q) ||
        (e.muscle?.toLowerCase().includes(q) ?? false) ||
        (e.equipment?.toLowerCase().includes(q) ?? false)
      );
    });
    // Favorieten bovenaan (stabiel — behoudt de alfabetische volgorde daarbinnen).
    // Gebruikt de bevroren snapshot zodat toggelen de volgorde niet verspringt.
    if (!favOnly) {
      list.sort(
        (a, b) => Number(sortFavorites.has(b.id)) - Number(sortFavorites.has(a.id))
      );
    }
    return list;
  }, [exercises, query, bodyPart, favOnly, favorites, sortFavorites]);

  return (
    <div className="flex flex-1 flex-col gap-4 px-5 py-7">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-neutral-900">
          {t("title")}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          {t("subtitle")}
        </p>
      </div>

      {/* Zoeken */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="w-full rounded-2xl border border-border bg-surface-1 py-3 pl-10 pr-10 text-sm text-neutral-900 outline-none focus:border-accent"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label={t("clear")}
            className="absolute right-3 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-neutral-400 hover:text-neutral-700"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>

      {/* Filter op favorieten + lichaamsdeel */}
      {bodyParts.length > 0 || favorites.size > 0 ? (
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {favorites.size > 0 ? (
            <Chip active={favOnly} onClick={() => setFavOnly((v) => !v)}>
              <Star className={cn("size-3.5", favOnly && "fill-current")} />
              {t("favorites")}
            </Chip>
          ) : null}
          {bodyParts.length > 0 ? (
            <Chip active={bodyPart === null && !favOnly} onClick={() => { setBodyPart(null); setFavOnly(false); }}>
              {t("all")}
            </Chip>
          ) : null}
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
          title={t("emptyTitle")}
          description={exercises.length === 0 ? t("emptyNone") : t("emptyFilter")}
        />
      ) : (
        <ul className="grid grid-cols-2 gap-3">
          {filtered.map((e) => (
            <li key={e.id}>
              <Link
                href={`/member/history/exercise/${e.id}`}
                className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface-1 shadow-sm transition-transform active:scale-[0.98]"
              >
                <div className="relative aspect-square w-full overflow-hidden bg-surface-2">
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
                  <button
                    type="button"
                    onClick={(ev) => {
                      ev.preventDefault();
                      ev.stopPropagation();
                      toggleFavorite(e.id);
                    }}
                    aria-label={t("favoriteToggle")}
                    aria-pressed={favorites.has(e.id)}
                    className="absolute right-1.5 top-1.5 flex size-8 items-center justify-center rounded-full bg-surface-0/80 text-neutral-400 shadow-sm backdrop-blur transition-colors active:scale-90"
                  >
                    <Star
                      className={cn(
                        "size-4",
                        favorites.has(e.id) && "fill-current text-accent"
                      )}
                    />
                  </button>
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
                    {t("view")} <ChevronRight className="size-3.5" />
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
        "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-medium capitalize transition-colors",
        active
          ? "border-accent bg-accent text-accent-foreground"
          : "border-border bg-surface-1 text-neutral-600 hover:bg-surface-2"
      )}
    >
      {children}
    </button>
  );
}
