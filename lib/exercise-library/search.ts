import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  bodyPartLabel,
  machineTypeFromLibrary,
  LIBRARY_CATEGORY_LABEL,
  LIBRARY_DIFFICULTY_LABEL,
  LIBRARY_GOAL_LABEL,
} from "@/lib/exercise-library/mapping";
import { disciplineTerms, rankLibraryMatches } from "@/lib/exercise-library/search-text";

/**
 * Gedeelde filter-logica voor de oefeningen-bibliotheek (Standaard-tab).
 * Eén bron van waarheid voor de paginaweergave én de bulk-toevoeg-actie, zodat
 * "selecteer alle resultaten" exact dezelfde set raakt als wat de owner ziet.
 * Spiegel van lib/catalog.ts (klassieke catalogus).
 */
export type LibraryFilter = {
  q?: string;
  bodyPart?: string;
  /** Materiaal-slug (LibraryEquipment.id), bv. "barbell". */
  equipment?: string;
  difficulty?: string;
  goal?: string;
  /** Alleen oefeningen voor apparatuur die de tenant daadwerkelijk heeft staan. */
  onlyMyEquipment?: boolean;
  /**
   * Koppelstatus met de sportschool: `"missing"` = nog niet als tenant-Exercise
   * gekoppeld (→ in bulk toevoegen), `"present"` = al gekoppeld. Weggelaten =
   * beide. Omdat élke sportschool standaard de hele bibliotheek krijgt, is
   * "missing" vooral de lijst van wat de eigenaar zelf verwijderde of wat een
   * dataset-update nieuw bracht.
   */
  inGym?: "missing" | "present";
};

/**
 * Tenant-afhankelijke context voor {@link buildLibraryQuery}: alleen de delen
 * die het filter écht nodig heeft worden opgehaald. Eén helper voor de
 * paginaweergave én de bulk-add, zodat "selecteer alle resultaten" nooit een
 * andere set raakt dan wat de owner ziet.
 */
export type LibraryQueryContext = {
  /** Materiaal-slugs van de eigen apparatuur (`null` = filter niet actief). */
  myEquipment: string[] | null;
  /** Gekoppelde bibliotheek-slugs van de tenant (`null` = filter niet actief). */
  ownedIds: string[] | null;
};

export async function libraryQueryContext(
  tenantId: string,
  filter: LibraryFilter
): Promise<LibraryQueryContext> {
  const [myEquipment, ownedIds] = await Promise.all([
    filter.onlyMyEquipment && !filter.equipment ? myLibraryEquipmentSlugs(tenantId) : null,
    filter.inGym ? ownedLibraryIds(tenantId) : null,
  ]);
  return { myEquipment, ownedIds };
}

/** Alle bibliotheek-slugs die als tenant-Exercise aan de sportschool hangen. */
export async function ownedLibraryIds(tenantId: string): Promise<string[]> {
  const rows = await prisma.exercise.findMany({
    where: { tenantId, libraryId: { not: null } },
    select: { libraryId: true },
  });
  return rows.map((r) => r.libraryId).filter((id): id is string => Boolean(id));
}

/**
 * Veiligheidslabels uit de bundel (`knee_safe`, `lower_back_safe`,
 * `shoulder_safe`, `no_axial_load`) blijven buiten de zoek-meta: ze staan op
 * honderden oefeningen, worden nergens getoond, en maakten de zoekfunctie
 * juist slechter — "schouders" matchte élke `shoulder_safe`-oefening en
 * "onderbenen" viel over `lower_back_safe`. De inhoudelijke tags
 * (`leg_day`, `calisthenics`, `stretching`, `warm_up`, …) blijven wel mee doen.
 */
function isSearchableTag(tag: string): boolean {
  return !tag.endsWith("_safe") && tag !== "no_axial_load";
}

/**
 * De materiaal-slugs waarvan het afgeleide machinetype overeenkomt met een
 * machinetype dat de tenant in huis heeft — plus altijd lichaamsgewicht
 * (`null`-materiaal wordt apart gematcht in {@link buildLibraryWhere}).
 */
export async function myLibraryEquipmentSlugs(tenantId: string): Promise<string[]> {
  const [machines, equipment] = await Promise.all([
    prisma.machine.findMany({ where: { tenantId }, select: { type: true } }),
    prisma.libraryEquipment.findMany({ select: { id: true, tags: true } }),
  ]);
  const myTypes = new Set<string>(machines.map((m) => m.type));
  if (myTypes.size === 0) return [];
  return equipment
    .filter((e) => myTypes.has(machineTypeFromLibrary(e.id, e.tags)))
    .map((e) => e.id);
}

/**
 * Bouwt de Prisma-`where` voor de bibliotheek. `ctx` komt uit
 * {@link libraryQueryContext} (eigen apparatuur + gekoppelde slugs, alleen
 * geladen als het filter erom vraagt). Een expliciet materiaal-filter wint van
 * "mijn apparatuur". Retired oefeningen vallen er altijd buiten.
 *
 * Zoeken loopt via de pure matcher in `search-text.ts` (woordvolgorde-
 * onafhankelijk, prefix/typo-tolerant, synoniemen/slug als substring): de
 * kandidaten worden hier geladen, gematcht en als `id in (…)` in de `where`
 * gezet — zo raken paginaweergave én "selecteer alle resultaten" (bulk-add)
 * gegarandeerd dezelfde set. `rankedIds` is de relevantie-volgorde (beste
 * eerst) voor de weergave; `null` zonder zoekterm.
 */
export async function buildLibraryQuery(
  filter: LibraryFilter,
  ctx: LibraryQueryContext
): Promise<{ where: Prisma.LibraryExerciseWhereInput; rankedIds: string[] | null }> {
  const { myEquipment, ownedIds } = ctx;
  // Extra voorwaarden stapelen in `AND`: de zoekterm zet zelf al `where.id`,
  // dus een tweede id-voorwaarde (koppelstatus) mag die niet overschrijven.
  const and: Prisma.LibraryExerciseWhereInput[] = [];
  const where: Prisma.LibraryExerciseWhereInput = {
    retiredAt: null,
    ...(filter.bodyPart ? { bodyPart: filter.bodyPart } : {}),
    ...(filter.difficulty ? { difficulty: filter.difficulty } : {}),
    ...(filter.goal ? { goals: { has: filter.goal } } : {}),
    AND: and,
  };

  if (filter.inGym && ownedIds) {
    and.push(
      filter.inGym === "missing"
        ? { id: { notIn: ownedIds } }
        : { id: { in: ownedIds } }
    );
  }

  let rankedIds: string[] | null = null;
  if (filter.q?.trim()) {
    const [candidates, muscles, equipment] = await Promise.all([
      prisma.libraryExercise.findMany({
        where: { retiredAt: null },
        select: {
          id: true,
          synonyms: true,
          category: true,
          bodyPart: true,
          difficulty: true,
          equipmentSlug: true,
          primaryMuscles: true,
          secondaryMuscles: true,
          goals: true,
          tags: true,
          exerciseType: true,
          isBodyweight: true,
          texts: { select: { name: true } },
        },
      }),
      prisma.libraryMuscle.findMany({ select: { id: true, names: true, synonyms: true } }),
      prisma.libraryEquipment.findMany({ select: { id: true, names: true, synonyms: true } }),
    ]);
    // Slug → alle weergavenamen (alle talen) + synoniemen, zodat "triceps" of
    // "loopband" ook via de spier-/materiaalkant matcht (lager gewicht).
    const lookupTexts = (rows: { id: string; names: unknown; synonyms: string[] }[]) =>
      new Map(
        rows.map((r) => [
          r.id,
          [
            ...(r.names && typeof r.names === "object" && !Array.isArray(r.names)
              ? Object.values(r.names).filter((v): v is string => typeof v === "string")
              : []),
            ...r.synonyms,
          ],
        ])
      );
    const muscleTexts = lookupTexts(muscles);
    const equipmentTexts = lookupTexts(equipment);

    rankedIds = rankLibraryMatches(
      filter.q,
      candidates.map((c) => ({
        id: c.id,
        // De slug is een betekenisvolle naam (RepDB) en telt mee als zoektekst.
        names: [c.id, ...new Set(c.texts.map((t) => t.name))],
        synonyms: c.synonyms,
        meta: [
          // ELKE ZICHTBARE LABEL IS DOORZOEKBAAR: de grid en de filters tonen
          // "Bovenbenen"/"Kracht"/"Gevorderd", dus dát woord moet ook treffers
          // geven. De rauwe dataset-waarde blijft ernaast staan (Engels +
          // glossarium-expansie); zo werkt het ook zonder labeltabel.
          ...(c.bodyPart ? [c.bodyPart, bodyPartLabel(c.bodyPart)] : []),
          // Categorie/doelen/tags/type: "stretching", "mobility", "hiit",
          // "warm_up" (underscore normaliseert naar spatie) — bereikbaar via
          // de NL-termen in het glossarium ("rekken", "lenigheid", …).
          c.category,
          c.category ? LIBRARY_CATEGORY_LABEL[c.category] : null,
          ...c.goals,
          ...c.goals.map((g) => LIBRARY_GOAL_LABEL[g]),
          ...c.tags.filter(isSearchableTag),
          c.exerciseType,
          c.difficulty ? LIBRARY_DIFFICULTY_LABEL[c.difficulty] : null,
          ...(c.isBodyweight ? ["bodyweight"] : []),
          // RepDB labelt yoga/pilates niet; afgeleid uit naam + synoniemen.
          ...disciplineTerms([c.id, ...c.texts.map((t) => t.name), ...c.synonyms]),
          ...[...c.primaryMuscles, ...c.secondaryMuscles].flatMap((slug) => [
            slug,
            ...(muscleTexts.get(slug) ?? []),
          ]),
          ...(c.equipmentSlug
            ? [c.equipmentSlug, ...(equipmentTexts.get(c.equipmentSlug) ?? [])]
            : []),
        ].filter((v): v is string => Boolean(v)),
      }))
    );
    where.id = { in: rankedIds };
  }

  if (filter.equipment) {
    where.equipmentSlug = filter.equipment;
  } else if (filter.onlyMyEquipment && myEquipment) {
    // Lichaamsgewicht-oefeningen kunnen altijd; materiaal moet matchen. Lege
    // set machines → alleen lichaamsgewicht (bewust geen sentinel zoals bij de
    // klassieke catalogus: zonder machines blijft er zo tóch iets bruikbaars).
    and.push({
      OR: [
        { equipmentSlug: null },
        ...(myEquipment.length ? [{ equipmentSlug: { in: myEquipment } }] : []),
      ],
    });
  }

  return { where, rankedIds };
}

/** Sorteernaam: Engelse tekst-rij (weergave-namen in de grid zijn ook en). */
export const LIBRARY_ORDER_BY: Prisma.LibraryExerciseOrderByWithRelationInput = {
  id: "asc",
};
