import "server-only";
import { prisma } from "@/lib/db";
import { getMemberLibrary, type MemberLibraryRow } from "@/lib/member-library";
import { MEMBER_LIBRARY_WHERE, MEMBER_DAY_LIBRARY_WHERE } from "@/lib/member-library-rules";
import {
  MEMBER_DAY_TEMPLATES,
  getMemberDayTemplate,
  type MemberDayTemplate,
} from "@/lib/member-day-templates";
import { schemaImage, libraryTemplateImage } from "@/lib/schema-image";
import {
  parseLibraryTemplateDays,
  pickJsonName,
  trainingGoalFromLibrary,
} from "@/lib/exercise-library/mapping";
import { libraryTemplateBadges } from "@/lib/schema-badges";
import {
  libraryTemplateNl,
  libraryTemplateDayName,
  isLibraryTemplateHidden,
  swapLibraryExerciseSlug,
} from "@/lib/library-template-nl";
import { exerciseThumbUrl, EXERCISE_THUMB_RELATIONS } from "@/lib/exercise-thumb";
import {
  parseCatalogLevel,
  type CatalogRow,
  type CatalogSource,
} from "@/lib/member-catalog-core";

/**
 * Server-assemblage van de lid-template-catalogus: bundelt de vier bronnen
 * (zie lib/member-catalog-core.ts) tot één geserialiseerde `CatalogRow[]`.
 * Tenant-isolatie via expliciete `tenantId`-filters (+ RLS-backstop); de
 * RepDB-tabellen zijn bewust globaal (zoals ExerciseCatalog).
 */

type Branding = { logoUrl?: string | null };

/** Niveau van een tenant-template: afgeleid uit de beginner-badge (meer is er niet). */
function tenantLevel(badges: string[]): "beginner" | null {
  return badges.includes("beginner") ? "beginner" : null;
}

function tenantRow(
  t: MemberLibraryRow,
  branding: Branding,
  source: Extract<CatalogSource, "tenant" | "tenantday">,
  type: "week" | "day"
): CatalogRow {
  return {
    source,
    id: t.id,
    type,
    name: t.name,
    description: t.description,
    goals: t.goal ? [t.goal] : [],
    badges: t.badges,
    dayCount: Math.max(1, t._count.days),
    exerciseCount: t._count.items,
    daysPerWeek: null,
    level: tenantLevel(t.badges),
    minutes: null,
    validityWeeks: t.validityWeeks,
    image: schemaImage(t, branding),
  };
}

function dayRegistryRow(def: MemberDayTemplate): CatalogRow {
  return {
    source: "day",
    id: def.key,
    type: "day",
    name: def.name,
    description: def.description,
    goals: def.goals,
    badges: def.badges,
    dayCount: 1,
    exerciseCount: def.items.length,
    daysPerWeek: null,
    level: def.level ?? (def.badges.includes("beginner") ? "beginner" : null),
    minutes: def.minutes,
    validityWeeks: null,
    image: libraryTemplateImage(def.photoSlug, def.goals[0] ?? null),
  };
}

type RepdbTemplate = {
  id: string;
  goal: string;
  difficulty: string;
  frequencyPerWeek: number | null;
  names: unknown;
  descriptions: unknown;
  days: unknown;
};

function repdbRow(t: RepdbTemplate): CatalogRow {
  const days = parseLibraryTemplateDays(t.days);
  const goal = trainingGoalFromLibrary(t.goal);
  const nl = libraryTemplateNl(t.id);
  return {
    source: "repdb",
    id: t.id,
    // HET TYPE VOLGT HET ECHTE AANTAL DAGEN, het staat niet vast op "week".
    // Negen van de vijftien RepDB-rijen zijn één trainingsdag (waaronder een
    // warming-up en een core-afsluiter). Als "week" stonden die onder "Complete
    // schema's" met de knop "Gebruik dit schema", zodat een lid een warming-up
    // als zijn actieve schema kon instellen, en de optie "voeg toe als dag"
    // bleef verborgen omdat die achter `row.type === "day"` zit.
    type: days.length > 1 ? "week" : "day",
    name: nl?.name ?? pickJsonName(t.names, ["nl", "en"]) ?? t.id,
    description: nl?.description ?? pickJsonName(t.descriptions, ["nl", "en"]),
    goals: goal ? [goal] : [],
    badges: libraryTemplateBadges(t),
    dayCount: Math.max(1, days.length),
    exerciseCount: days.reduce((sum, d) => sum + (d.exercises?.length ?? 0), 0),
    daysPerWeek: t.frequencyPerWeek,
    level: parseCatalogLevel(t.difficulty),
    minutes: null,
    validityWeeks: null,
    image: libraryTemplateImage(t.id, t.goal),
  };
}

/**
 * De volledige catalogus voor dit lid: week-templates (RepDB + vrijgegeven
 * gym-schema's, ontdubbeld) en dag-templates (registry + vrijgegeven
 * gym-dagen). Alfabetisch per groep; de "past bij jouw doel"-sortering doet
 * de pagina met `sortByGoalMatch` (personalisatie is een lens, geen filter).
 *
 * Dedupe-regel: heeft de sportschool een RepDB-schema geïmporteerd én
 * vrijgegeven, dan wint de gym-versie (de owner kan 'm aangepast hebben).
 * Een niet-vrijgegeven import verbergt de RepDB-variant bewust níét.
 */
export async function getMemberCatalog(
  tenantId: string,
  branding: Branding = {}
): Promise<CatalogRow[]> {
  const [tenantTemplates, tenantDays, repdbTemplates] = await Promise.all([
    getMemberLibrary(tenantId),
    prisma.workoutTemplate.findMany({
      where: { tenantId, ...MEMBER_DAY_LIBRARY_WHERE },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        goal: true,
        badges: true,
        imageUrl: true,
        libraryTemplateId: true,
        validityWeeks: true,
        updatedAt: true,
        _count: { select: { items: true, days: true } },
      },
    }),
    prisma.libraryWorkoutTemplate.findMany({
      where: { retiredAt: null },
      orderBy: { id: "asc" },
      select: {
        id: true,
        goal: true,
        difficulty: true,
        frequencyPerWeek: true,
        names: true,
        descriptions: true,
        days: true,
      },
    }),
  ]);

  const releasedImports = new Set(
    tenantTemplates.map((t) => t.libraryTemplateId).filter(Boolean)
  );

  // Eenmaal omzetten: het type bepaalt in welke groep de rij landt, en bewust
  // verborgen duplicaten van een dag-template vallen hier af (de owner-import
  // op /owner/schemas/templates toont ze wél gewoon).
  const repdbRows = repdbTemplates
    .filter((t) => !releasedImports.has(t.id) && !isLibraryTemplateHidden(t.id))
    .map(repdbRow);

  const weeks = [
    ...tenantTemplates.map((t) => tenantRow(t, branding, "tenant", "week")),
    ...repdbRows.filter((r) => r.type === "week"),
  ].sort((a, b) => a.name.localeCompare(b.name, "nl"));

  const days = [
    ...tenantDays.map((t) => tenantRow(t, branding, "tenantday", "day")),
    ...MEMBER_DAY_TEMPLATES.map(dayRegistryRow),
    ...repdbRows.filter((r) => r.type === "day"),
  ].sort((a, b) => a.name.localeCompare(b.name, "nl"));

  return [...weeks, ...days];
}

export type CatalogDetailItem = {
  name: string;
  sets: number | null;
  /** Rauwe RepDB-notatie ("8-12", "AMRAP") of de kolomwaarde als tekst. */
  reps: string | null;
  restSeconds: number | null;
  notes: string | null;
  thumbUrl: string | null;
  /** Staat de oefening al in deze sportschool? (false = wordt bij overnemen toegevoegd) */
  inGym: boolean;
};
export type CatalogDetailDay = { name: string; items: CatalogDetailItem[] };
export type CatalogDetail = {
  row: CatalogRow;
  days: CatalogDetailDay[];
  /** Aantal unieke oefeningen dat overnemen aan de sportschool toevoegt. */
  newExerciseCount: number;
};

const detailItemInclude = {
  orderBy: { order: "asc" },
  include: { exercise: { include: EXERCISE_THUMB_RELATIONS } },
} as const;

/** Detailinhoud van RepDB-slugs (gedeeld door de repdb- en day-bron). */
async function slugDetailDays(
  tenantId: string,
  days: { name: string; exercises: { slug: string; sets: number | null; reps: string | null; restSeconds: number | null; notes: string | null }[] }[]
): Promise<{ detailDays: CatalogDetailDay[]; newExerciseCount: number }> {
  const slugs = [...new Set(days.flatMap((d) => d.exercises.map((e) => e.slug)))];
  const [libRows, owned] = await Promise.all([
    slugs.length > 0
      ? prisma.libraryExercise.findMany({
          where: { id: { in: slugs } },
          select: {
            id: true,
            imageAlias: true,
            images: true,
            texts: { where: { locale: "en" }, select: { name: true } },
          },
        })
      : Promise.resolve([]),
    slugs.length > 0
      ? prisma.exercise.findMany({
          where: { tenantId, libraryId: { in: slugs } },
          select: { libraryId: true },
        })
      : Promise.resolve([]),
  ]);
  const byId = new Map(libRows.map((l) => [l.id, l]));
  const inGym = new Set(owned.map((e) => e.libraryId as string));

  const detailDays = days.map((day) => ({
    name: day.name,
    // Onbekende slugs (bv. geretireerd in een nieuwe bundel) vallen weg — de
    // detailweergave toont precies wat overnemen écht oplevert.
    items: day.exercises.flatMap((e) => {
      const lib = byId.get(e.slug);
      if (!lib) return [];
      return [
        {
          name: lib.texts[0]?.name ?? e.slug.replace(/-/g, " "),
          sets: e.sets,
          reps: e.reps,
          restSeconds: e.restSeconds,
          notes: e.notes,
          thumbUrl: exerciseThumbUrl({ library: lib }),
          inGym: inGym.has(e.slug),
        },
      ];
    }),
  }));
  const known = slugs.filter((s) => byId.has(s));
  return { detailDays, newExerciseCount: known.filter((s) => !inGym.has(s)).length };
}

/**
 * Volledige inhoud van één catalogustemplate (detailpagina). `null` buiten de
 * catalogus: niet vrijgegeven, andere tenant, geretireerd of onbekende key —
 * de pagina doet dan `notFound()`.
 */
export async function getCatalogDetail(
  source: CatalogSource,
  id: string,
  tenantId: string,
  branding: Branding = {}
): Promise<CatalogDetail | null> {
  if (source === "tenant" || source === "tenantday") {
    const where = source === "tenant" ? MEMBER_LIBRARY_WHERE : MEMBER_DAY_LIBRARY_WHERE;
    const tpl = await prisma.workoutTemplate.findFirst({
      where: { id, tenantId, ...where },
      include: {
        days: { orderBy: { order: "asc" }, include: { items: detailItemInclude } },
        _count: { select: { items: true, days: true } },
      },
    });
    if (!tpl) return null;
    const row = tenantRow(
      { ...tpl, _count: tpl._count },
      branding,
      source,
      source === "tenant" ? "week" : "day"
    );
    return {
      row,
      days: tpl.days.map((d) => ({
        name: d.name,
        items: d.items.map((it) => ({
          name: it.exercise.name,
          sets: it.sets,
          reps: String(it.reps),
          restSeconds: it.restSeconds,
          notes: it.notes,
          thumbUrl: exerciseThumbUrl(it.exercise),
          inGym: true,
        })),
      })),
      newExerciseCount: 0,
    };
  }

  if (source === "repdb") {
    // Verborgen rijen (duplicaat van een dag-template) blijven ook via een
    // directe URL onbereikbaar; anders zou de dedupe alleen cosmetisch zijn.
    if (isLibraryTemplateHidden(id)) return null;
    const tpl = await prisma.libraryWorkoutTemplate.findFirst({
      where: { id, retiredAt: null },
    });
    if (!tpl) return null;
    const days = parseLibraryTemplateDays(tpl.days);
    const { detailDays, newExerciseCount } = await slugDetailDays(
      tenantId,
      days.map((d, i) => ({
        name: libraryTemplateDayName(tpl.id, i, d.name_en?.trim() || `Dag ${i + 1}`),
        exercises: (d.exercises ?? []).map((e) => ({
          slug: swapLibraryExerciseSlug(tpl.id, e.exercise_id),
          sets: e.sets ?? null,
          reps: e.reps?.trim() || null,
          restSeconds: e.rest_seconds ?? null,
          notes: e.notes_en?.trim() || null,
        })),
      }))
    );
    return { row: repdbRow(tpl), days: detailDays, newExerciseCount };
  }

  const def = getMemberDayTemplate(id);
  if (!def) return null;
  const { detailDays, newExerciseCount } = await slugDetailDays(tenantId, [
    {
      name: def.name,
      exercises: def.items.map((e) => ({
        slug: e.slug,
        sets: e.sets,
        reps: e.reps,
        restSeconds: e.restSeconds,
        notes: e.notes ?? null,
      })),
    },
  ]);
  return { row: dayRegistryRow(def), days: detailDays, newExerciseCount };
}
