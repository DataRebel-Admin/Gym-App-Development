import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { machineTypeFromLibrary } from "@/lib/exercise-library/mapping";
import { rankLibraryMatches } from "@/lib/exercise-library/search-text";

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
};

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
 * Bouwt de Prisma-`where` voor de bibliotheek. `myEquipment` alleen nodig bij
 * `onlyMyEquipment` (uitkomst van {@link myLibraryEquipmentSlugs}). Een expliciet
 * materiaal-filter wint van "mijn apparatuur". Retired oefeningen vallen er
 * altijd buiten.
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
  myEquipment: string[] | null
): Promise<{ where: Prisma.LibraryExerciseWhereInput; rankedIds: string[] | null }> {
  const where: Prisma.LibraryExerciseWhereInput = {
    retiredAt: null,
    ...(filter.bodyPart ? { bodyPart: filter.bodyPart } : {}),
    ...(filter.difficulty ? { difficulty: filter.difficulty } : {}),
    ...(filter.goal ? { goals: { has: filter.goal } } : {}),
  };

  let rankedIds: string[] | null = null;
  if (filter.q?.trim()) {
    const [candidates, muscles, equipment] = await Promise.all([
      prisma.libraryExercise.findMany({
        where: { retiredAt: null },
        select: {
          id: true,
          synonyms: true,
          bodyPart: true,
          equipmentSlug: true,
          primaryMuscles: true,
          secondaryMuscles: true,
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
          ...(c.bodyPart ? [c.bodyPart] : []),
          ...[...c.primaryMuscles, ...c.secondaryMuscles].flatMap((slug) => [
            slug,
            ...(muscleTexts.get(slug) ?? []),
          ]),
          ...(c.equipmentSlug
            ? [c.equipmentSlug, ...(equipmentTexts.get(c.equipmentSlug) ?? [])]
            : []),
        ],
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
    where.AND = [
      {
        OR: [
          { equipmentSlug: null },
          ...(myEquipment.length ? [{ equipmentSlug: { in: myEquipment } }] : []),
        ],
      },
    ];
  }

  return { where, rankedIds };
}

/** Sorteernaam: Engelse tekst-rij (weergave-namen in de grid zijn ook en). */
export const LIBRARY_ORDER_BY: Prisma.LibraryExerciseOrderByWithRelationInput = {
  id: "asc",
};
