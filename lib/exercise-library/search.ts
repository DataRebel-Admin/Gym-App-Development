import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { machineTypeFromLibrary } from "@/lib/exercise-library/mapping";

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
 * altijd buiten. Zoeken matcht naam (elke taal) én synoniemen/slug.
 */
export function buildLibraryWhere(
  filter: LibraryFilter,
  myEquipment: string[] | null
): Prisma.LibraryExerciseWhereInput {
  const where: Prisma.LibraryExerciseWhereInput = {
    retiredAt: null,
    ...(filter.bodyPart ? { bodyPart: filter.bodyPart } : {}),
    ...(filter.difficulty ? { difficulty: filter.difficulty } : {}),
    ...(filter.goal ? { goals: { has: filter.goal } } : {}),
  };

  if (filter.q?.trim()) {
    const q = filter.q.trim();
    where.OR = [
      { texts: { some: { name: { contains: q, mode: "insensitive" } } } },
      { id: { contains: q.toLowerCase().replace(/\s+/g, "-") } },
      { synonyms: { has: q.toLowerCase() } },
    ];
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

  return where;
}

/** Sorteernaam: Engelse tekst-rij (weergave-namen in de grid zijn ook en). */
export const LIBRARY_ORDER_BY: Prisma.LibraryExerciseOrderByWithRelationInput = {
  id: "asc",
};
