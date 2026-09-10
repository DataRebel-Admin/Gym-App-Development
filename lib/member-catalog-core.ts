// Pure kern van de lid-template-catalogus — géén `server-only` (idioom
// lib/member-library-rules.ts): types, ref-parsing en filterlogica, testbaar
// zonder DB. De server-assemblage (welke rijen er zíjn) woont in
// lib/member-catalog.ts.
//
// De catalogus bundelt vier bronnen in één lijst:
//   - `tenant`    — door de sportschool vrijgegeven schema's (MEMBER_LIBRARY_WHERE)
//   - `repdb`     — de RepDB-voorbeeldschema's (LibraryWorkoutTemplate, globaal)
//   - `day`       — gecureerde dag-templates (lib/member-day-templates.ts)
//   - `tenantday` — vrijgegeven dag-templates van de sportschool (kind=DAY)

import type { SchemaImage } from "@/lib/schema-image";
import { rankLibraryMatches } from "@/lib/exercise-library/search-text";

export const CATALOG_SOURCES = ["tenant", "repdb", "day", "tenantday"] as const;
export type CatalogSource = (typeof CATALOG_SOURCES)[number];

export type CatalogType = "week" | "day";
export type CatalogLevel = "beginner" | "intermediate" | "advanced";

export const CATALOG_LEVEL_LABELS: Record<CatalogLevel, string> = {
  beginner: "Beginner",
  intermediate: "Gevorderd",
  advanced: "Ervaren",
};

/** Eén rij in de catalogus, klaar voor weergave (beeld al geresolved). */
export type CatalogRow = {
  source: CatalogSource;
  /** tenant/tenantday: WorkoutTemplate.id; repdb: slug; day: registry-key. */
  id: string;
  type: CatalogType;
  name: string;
  description: string | null;
  /** Trainingsdoelen (keys uit lib/training-goals.ts) — sortering + filter. */
  goals: string[];
  /** Badge-keys (lib/schema-badges.ts). */
  badges: string[];
  dayCount: number;
  exerciseCount: number;
  /** Aanbevolen trainingsfrequentie (RepDB) — valt terug op dayCount. */
  daysPerWeek: number | null;
  level: CatalogLevel | null;
  /** Duurindicatie in minuten (alleen dag-templates). */
  minutes: number | null;
  validityWeeks: number | null;
  image: SchemaImage | null;
  /**
   * Extra doorzoekbare termen: dagnamen, oefening-slugs en de labels van doel,
   * badge en niveau. Wordt nooit getoond, alleen gematcht. Server-side gevuld
   * (lib/member-catalog.ts) omdat de rij zelf geen oefeningen draagt — zelfde
   * idioom als de `terms`-lijst op /member/exercises.
   */
  terms: string[];
};

export function parseCatalogSource(v: string | null | undefined): CatalogSource | null {
  return CATALOG_SOURCES.includes(v as CatalogSource) ? (v as CatalogSource) : null;
}

export function parseCatalogLevel(v: string | null | undefined): CatalogLevel | null {
  return v && v in CATALOG_LEVEL_LABELS ? (v as CatalogLevel) : null;
}

/** De `source`-waarde voor `startMemberSchema` ("repdb:<slug>", "day:<key>", …). */
export function catalogStartSource(row: Pick<CatalogRow, "source" | "id">): string {
  // Tenant-schema's gebruiken de bestaande "template:"-bron van de builder.
  return `${row.source === "tenant" ? "template" : row.source}:${row.id}`;
}

export function catalogHref(row: Pick<CatalogRow, "source" | "id">): string {
  return `/member/schema/templates/${row.source}/${encodeURIComponent(row.id)}`;
}

/** Effectieve trainingsdagen per week van een rij (voor het dagen-filter). */
export function rowDaysPerWeek(row: Pick<CatalogRow, "daysPerWeek" | "dayCount">): number {
  return row.daysPerWeek ?? row.dayCount;
}

export type CatalogFilters = {
  type: CatalogType | null;
  goal: string | null;
  /** "1".."4" exact, "5" = 5 of meer. */
  days: string | null;
  level: CatalogLevel | null;
  q: string | null;
};

export const CATALOG_DAYS_OPTIONS = [
  { value: "1", label: "1 dag" },
  { value: "2", label: "2 dagen" },
  { value: "3", label: "3 dagen" },
  { value: "4", label: "4 dagen" },
  { value: "5", label: "5+ dagen" },
] as const;

export function parseCatalogFilters(sp: {
  type?: string;
  goal?: string;
  dagen?: string;
  niveau?: string;
  q?: string;
}): CatalogFilters {
  const type = sp.type === "week" || sp.type === "day" ? sp.type : null;
  return {
    type,
    goal: sp.goal?.trim() || null,
    days: CATALOG_DAYS_OPTIONS.some((o) => o.value === sp.dagen) ? (sp.dagen as string) : null,
    level: parseCatalogLevel(sp.niveau),
    q: sp.q?.trim() || null,
  };
}

/**
 * Filter de catalogus. Elke actieve filter versmalt; een rij zonder niveau valt
 * weg zodra er op niveau gefilterd wordt (geen niveau = onbekend, niet "alles").
 * Onbekende doel-keys negeren we defensief (zelfde regel als getMemberLibrary).
 */
/**
 * DE ZOEKTERM LOOPT VIA DE GEDEELDE FUZZY MATCHER, NOOIT VIA EEN KALE
 * `includes`. Dit vlak deed dat wél, waardoor het het enige zoekveld in de app
 * was zonder tikfout-tolerantie, zonder woordvolgorde-onafhankelijkheid en
 * zonder de NL→EN-expansie: "bankdrukken" of "bilspieren" gaf hier nul
 * treffers terwijl dezelfde term in de bibliotheek en in de pickers gewoon
 * werkt. Zie `lib/exercise-library/search-text.ts`.
 *
 * De naam weegt het zwaarst; omschrijving, dagnamen, oefening-slugs en de
 * labels van doel/badge/niveau matchen mee met lager gewicht (`meta`). Bij een
 * zoekterm komt de lijst op **relevantie** terug; zonder zoekterm blijft de
 * aangeleverde volgorde staan. De doel-sortering die de pagina daarna doet is
 * stabiel, dus die houdt de relevantievolgorde binnen beide groepen intact.
 */
export function filterCatalog(rows: CatalogRow[], f: CatalogFilters): CatalogRow[] {
  const narrowed = rows.filter((row) => {
    if (f.type && row.type !== f.type) return false;
    if (f.goal && !row.goals.includes(f.goal)) return false;
    if (f.days) {
      const n = rowDaysPerWeek(row);
      if (f.days === "5" ? n < 5 : n !== Number(f.days)) return false;
    }
    if (f.level && row.level !== f.level) return false;
    return true;
  });

  const q = f.q?.trim();
  if (!q) return narrowed;

  const byId = new Map(narrowed.map((r) => [catalogRowKey(r), r]));
  const ranked = rankLibraryMatches(
    q,
    narrowed.map((r) => ({
      id: catalogRowKey(r),
      names: [r.name],
      synonyms: [],
      meta: [r.description ?? "", ...r.terms].filter(Boolean),
    }))
  );
  return ranked.flatMap((id) => {
    const row = byId.get(id);
    return row ? [row] : [];
  });
}

/**
 * Unieke sleutel over de bronnen heen. Een RepDB-slug en een tenant-cuid kunnen
 * nooit botsen, maar een gecureerd dag-template en een vrijgegeven gym-dag wél
 * (beide vrije strings), dus de bron hoort in de sleutel.
 */
function catalogRowKey(row: Pick<CatalogRow, "source" | "id">): string {
  return `${row.source}:${row.id}`;
}

/** Is er überhaupt een filter actief? (Voor "wis filters" en de lege staat.) */
export function hasActiveCatalogFilter(f: CatalogFilters): boolean {
  return Boolean(f.type || f.goal || f.days || f.level || f.q);
}
