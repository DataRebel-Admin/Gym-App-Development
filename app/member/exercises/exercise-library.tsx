"use client";

import { useDeferredValue, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { EXERCISE_KIND_ORDER, type ExerciseKind } from "@/lib/exercise-library/kinds";
import { rankLibraryMatches } from "@/lib/exercise-library/search-text";
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
  /** Grove soorten (kracht/cardio/core/stretch/yoga/pilates), zie lib/exercise-library/kinds.ts. */
  kinds: ExerciseKind[];
  /** Extra zoekwoorden (lichaamsdeel, categorie, soort, synoniemen) — niet getoond. */
  terms: string[];
};

/**
 * Doorzoekbare oefeningenbibliotheek voor leden. Toont de gecureerde oefeningen
 * van de eigen sportschool met thumbnail + spiergroep; tikken opent de
 * detailpagina met animatie, stappenplan en uitleg. Filteren op lichaamsdeel,
 * soort (kracht/cardio/core/stretch/yoga/pilates) en vrije tekst — client-side
 * (gecureerde set is klein). De filters combineren (EN).
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
  // Het invoerveld reageert direct; het ranken van de hele bibliotheek (±600
  // oefeningen, fuzzy + NL-expansie) loopt op de uitgestelde waarde, zodat
  // typen op een telefoon niet hapert.
  const deferredQuery = useDeferredValue(query);
  const [bodyPart, setBodyPart] = useState<string | null>(null);
  const [kind, setKind] = useState<ExerciseKind | null>(null);
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

  // Alleen soorten die in deze sportschool voorkomen — een lege chip is ruis.
  const kinds = useMemo(() => {
    const present = new Set<ExerciseKind>();
    for (const e of exercises) for (const k of e.kinds) present.add(k);
    return EXERCISE_KIND_ORDER.filter((k) => present.has(k));
  }, [exercises]);

  // Bevroren snapshot van de favorieten voor de "favorieten-bovenaan"-sortering.
  // We verversen 'm alléén als de zoek/filter-weergave verandert — niet bij een
  // toggle — zodat een net-aangetikte favoriet niet meteen naar boven springt en
  // de lijst niet onder je vinger wegscrolt.
  const sortFavorites = useMemo(
    () => new Set(favorites),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deferredQuery, bodyPart, kind, favOnly]
  );

  const filtered = useMemo(() => {
    const q = deferredQuery.trim();
    const list = exercises.filter((e) => {
      if (favOnly && !favorites.has(e.id)) return false;
      if (bodyPart && e.bodyPart !== bodyPart) return false;
      if (kind && !e.kinds.includes(kind)) return false;
      return true;
    });
    if (q) {
      // Dezelfde fuzzy matcher als de owner-bibliotheek: woordvolgorde-
      // onafhankelijk, typo-tolerant en met NL→EN-expansie, en hij kijkt naar
      // spier, lichaamsdeel, materiaal, categorie/soort en synoniemen. Een
      // kale `includes` op naam/spier/materiaal gaf niets op "bovenbenen" of
      // "yoga". Met zoekterm bepaalt de relevantie de volgorde (favorieten
      // bovenaan zou de beste treffer naar beneden duwen).
      const ranked = rankLibraryMatches(
        q,
        list.map((e) => ({
          id: e.id,
          names: [e.name],
          synonyms: [],
          meta: [e.muscle, e.bodyPart, e.equipment, ...e.terms].filter(
            (v): v is string => Boolean(v)
          ),
        }))
      );
      const byId = new Map(list.map((e) => [e.id, e]));
      return ranked
        .map((id) => byId.get(id))
        .filter((e): e is LibraryExercise => Boolean(e));
    }
    // Favorieten bovenaan (stabiel — behoudt de alfabetische volgorde daarbinnen).
    // Gebruikt de bevroren snapshot zodat toggelen de volgorde niet verspringt.
    if (!favOnly) {
      list.sort(
        (a, b) => Number(sortFavorites.has(b.id)) - Number(sortFavorites.has(a.id))
      );
    }
    return list;
  }, [exercises, deferredQuery, bodyPart, kind, favOnly, favorites, sortFavorites]);

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
          className="w-full rounded-2xl border border-border bg-surface-1 py-3 pl-10 pr-10 text-sm text-neutral-900 outline-none focus:border-accent [&::-webkit-search-cancel-button]:hidden"
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
            <Chip
              active={bodyPart === null && kind === null && !favOnly}
              onClick={() => {
                setBodyPart(null);
                setKind(null);
                setFavOnly(false);
              }}
            >
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

      {/* Filter op soort: kracht/cardio/core/stretching/yoga/pilates. Eén
          actieve chip; nogmaals tikken = deselecteren. Combineert met de
          lichaamsdeel-filter hierboven. */}
      {kinds.length > 1 ? (
        <div
          role="group"
          aria-label={t("kindLabel")}
          className="-mx-5 flex items-center gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <span className="shrink-0 text-xs font-medium text-neutral-500">{t("kindLabel")}</span>
          {kinds.map((k) => (
            <Chip
              key={k}
              active={kind === k}
              pressed
              onClick={() => setKind((cur) => (cur === k ? null : k))}
            >
              {t(`kinds.${k}`)}
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
                    <Image
                      src={e.thumbUrl}
                      alt=""
                      aria-hidden
                      fill
                      sizes="(max-width: 480px) 50vw, 224px"
                      // Catalogus-thumbnails zijn statische .jpg → optimaliseren.
                      // Mocht een bron ooit een .gif zijn: onbewerkt laten (animatie).
                      unoptimized={e.thumbUrl.toLowerCase().endsWith(".gif")}
                      className="object-cover"
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
  pressed,
  onClick,
  children,
}: {
  active: boolean;
  /** Toggle-chip (aan/uit) i.p.v. een keuze uit een set → `aria-pressed`. */
  pressed?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed ? active : undefined}
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
