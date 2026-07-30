import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { EXERCISE_THUMB_RELATIONS } from "@/lib/exercise-thumb";
import { isTrainingGoal } from "@/lib/training-goals";
import { MEMBER_LIBRARY_WHERE } from "@/lib/member-library-rules";

/**
 * Leeslaag van de **workout-library voor leden**: de schema's die de sportschool
 * heeft vrijgegeven (`WorkoutTemplate.memberVisible`). Read-only — overnemen
 * loopt via de bestaande `startMemberSchema` (die de bron zelf opnieuw
 * valideert met dezelfde `MEMBER_LIBRARY_WHERE`).
 *
 * Tenant-isolatie via expliciete `tenantId`-filters (+ RLS-backstop), zoals
 * lib/member-schema.ts. De pure where-clause/predicaat staan in
 * lib/member-library-rules.ts zodat ze testbaar zijn zonder DB.
 */

/** Filters van het library-overzicht (alles optioneel = geen filter). */
export type MemberLibraryFilters = {
  /** Vrije zoekterm op naam/omschrijving. */
  q?: string | null;
  /** Trainingsdoel-key uit lib/training-goals.ts. */
  goal?: string | null;
};

const listSelect = {
  id: true,
  name: true,
  description: true,
  goal: true,
  badges: true,
  // Beeld: eigen foto, of de herkomst-foto van het voorbeeldschema waaruit de
  // sportschool dit schema overnam (zie lib/schema-image.ts). Zonder deze twee
  // velden valt élk sjabloon terug op het logo — dan lijken ze allemaal gelijk.
  imageUrl: true,
  libraryTemplateId: true,
  // Geldigheid hoort bij het schema en wordt meegekloond — het lid ziet dus
  // vooraf of dit een tijdelijk programma is.
  validityWeeks: true,
  updatedAt: true,
  _count: { select: { items: true, days: true } },
} as const;

export type MemberLibraryRow = Prisma.WorkoutTemplateGetPayload<{
  select: typeof listSelect;
}>;

/**
 * Vrijgegeven schema's van de sportschool, alfabetisch. Zonder filters is dit
 * exact de lijst die de builder als startsjabloon aanbiedt — één query voor
 * beide oppervlakken, zodat "zichtbaar in de library" en "bruikbaar als
 * startpunt" niet uit elkaar kunnen lopen.
 */
export async function getMemberLibrary(
  tenantId: string,
  filters: MemberLibraryFilters = {}
): Promise<MemberLibraryRow[]> {
  const q = filters.q?.trim();
  const goal = filters.goal?.trim();

  return prisma.workoutTemplate.findMany({
    where: {
      tenantId,
      ...MEMBER_LIBRARY_WHERE,
      // Onbekende doel-key (bv. een verouderde bookmark) → filter negeren i.p.v.
      // een lege lijst tonen; defensief parsen zoals elders in de app.
      ...(isTrainingGoal(goal) ? { goal } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { description: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
    select: listSelect,
  });
}

/**
 * Hoeveel schema's staan er in de library? Voedt de zichtbaarheid van de
 * navigatie-ingang: zonder vrijgegeven schema's bestaat de library niet voor het
 * lid (dezelfde regel als `memberVisible` = de opt-in van de owner).
 */
export async function countMemberLibrary(tenantId: string): Promise<number> {
  return prisma.workoutTemplate.count({
    where: { tenantId, ...MEMBER_LIBRARY_WHERE },
  });
}

const itemInclude = {
  orderBy: { order: "asc" },
  include: {
    exercise: {
      include: {
        machine: { select: { name: true } },
        // Bron-bewust beeld (bibliotheek → klassiek → eigen) — een losse
        // `catalog`-check levert sinds RepDB bijna nooit een afbeelding op.
        ...EXERCISE_THUMB_RELATIONS,
      },
    },
  },
} as const;

/**
 * Eén vrijgegeven schema met dagen én platte items — dezelfde vorm als
 * `getAssignedSchema`, zodat de detailweergave `SchemaOverview` kan hergebruiken
 * (meerdaags → per dag, anders één lijst).
 *
 * Retourneert `null` buiten de library (niet vrijgegeven, andere tenant, een
 * `DAY`-sjabloon of een persoonlijk lid-schema) → de pagina doet `notFound()`.
 */
export async function getMemberLibraryTemplate(id: string, tenantId: string) {
  return prisma.workoutTemplate.findFirst({
    where: { id, tenantId, ...MEMBER_LIBRARY_WHERE },
    include: {
      days: { orderBy: { order: "asc" }, include: { items: itemInclude } },
      items: itemInclude,
    },
  });
}

export type MemberLibraryTemplate = NonNullable<
  Awaited<ReturnType<typeof getMemberLibraryTemplate>>
>;
