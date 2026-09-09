import type { Prisma, PrismaClient } from "@prisma/client";
import { machineTypeFromLibrary, pickJsonName } from "@/lib/exercise-library/mapping";

/**
 * Dé kern voor "zet bibliotheek-oefeningen (RepDB) als tenant-Exercise neer".
 *
 * Bewust **zonder** `server-only` en met de Prisma-client als parameter: de
 * seed (eigen PrismaClient onder tsx), het backfill-script, de superadmin-
 * tenant-aanmaak (binnen een transactie) én de owner-bulk-add gebruiken
 * allemaal dit ene pad. Zo bestaat er één regel voor naam (en-tekstrij —
 * naamsbeleid: oefeningnamen niet vertalen), spier-snapshot (in de taal van
 * de lezer, herleidbaar door `resolveRegion`), oefeningstype (import-inferentie)
 * en de optionele machine-koppeling via het materiaal-afgeleide machinetype.
 *
 * **Standaard krijgt élke sportschool de hele bibliotheek** (`ids: "all"`):
 * de eigenaar verwijdert liever wat er niet staat dan dat hij 608 oefeningen
 * handmatig toevoegt. De aanvullende (klassieke) collectie doet daar bewust
 * niet aan mee. Idempotent: bestaande koppelingen worden **expliciet**
 * voorgefilterd — er is géén unique op (tenantId, libraryId), dus
 * `skipDuplicates` alleen zou dubbele rijen niet tegenhouden.
 */
export type LibrarySyncDb = Pick<
  PrismaClient | Prisma.TransactionClient,
  "libraryExercise" | "libraryEquipment" | "libraryMuscle" | "exercise" | "machine"
>;

export type AddLibraryExercisesOptions = {
  /** Slugs om toe te voegen, of `"all"` = alle niet-geretireerde oefeningen. */
  ids: string[] | "all";
  /** Taalvoorkeur voor de spier-snapshot (uitkomst van `datasetLocalePreference`). */
  localePref: string[];
  /** Koppel aan de eerste machine van het afgeleide machinetype (UI-default aan). */
  autoMachine?: boolean;
};

export type AddLibraryExercisesResult = { added: number; skipped: number };

const CHUNK = 500;

export async function addLibraryExercisesToTenant(
  db: LibrarySyncDb,
  tenantId: string,
  { ids, localePref, autoMachine = false }: AddLibraryExercisesOptions
): Promise<AddLibraryExercisesResult> {
  // 1) Doel-slugs.
  let targetIds: string[];
  if (ids === "all") {
    const rows = await db.libraryExercise.findMany({
      where: { retiredAt: null },
      select: { id: true },
    });
    targetIds = rows.map((r) => r.id);
  } else {
    targetIds = [...new Set(ids)];
  }
  if (targetIds.length === 0) return { added: 0, skipped: 0 };

  // 2) Reeds gekoppeld? Overslaan (expliciet, zodat `skipped` klopt).
  const existing = await db.exercise.findMany({
    where: { tenantId, libraryId: { in: targetIds } },
    select: { libraryId: true },
  });
  const existingSet = new Set(existing.map((e) => e.libraryId));
  const toAdd = targetIds.filter((id) => !existingSet.has(id));
  const skipped = targetIds.length - toAdd.length;
  if (toAdd.length === 0) return { added: 0, skipped };

  // 3) Bibliotheek-velden + lookups.
  const [libRows, equipment] = await Promise.all([
    db.libraryExercise.findMany({
      where: { id: { in: toAdd } },
      select: {
        id: true,
        primaryMuscles: true,
        equipmentSlug: true,
        exerciseType: true,
        texts: { where: { locale: "en" }, select: { name: true } },
      },
    }),
    autoMachine
      ? db.libraryEquipment.findMany({ select: { id: true, tags: true } })
      : Promise.resolve([] as { id: string; tags: string[] }[]),
  ]);
  if (libRows.length === 0) return { added: 0, skipped };
  const equipTags = new Map(equipment.map((e) => [e.id, e.tags]));

  const muscleIds = [...new Set(libRows.flatMap((l) => l.primaryMuscles[0] ?? []))];
  const muscles = muscleIds.length
    ? await db.libraryMuscle.findMany({
        where: { id: { in: muscleIds } },
        select: { id: true, names: true },
      })
    : [];
  // Spier-snapshot in `Exercise.targetMuscle`: anatomie ís vertaald (in
  // tegenstelling tot de oefeningnaam); elke nl-naam is herleidbaar door
  // `resolveRegion` zodat de spier-heatmap blijft kleuren.
  const muscleName = new Map(
    muscles.map((m) => [m.id, pickJsonName(m.names, localePref) ?? m.id.replace(/_/g, " ")])
  );

  const machineByType = new Map<string, string>();
  if (autoMachine) {
    const machines = await db.machine.findMany({
      where: { tenantId },
      select: { id: true, type: true },
    });
    for (const m of machines) {
      if (!machineByType.has(m.type)) machineByType.set(m.type, m.id);
    }
  }

  const data: Prisma.ExerciseCreateManyInput[] = libRows.map((l) => ({
    tenantId,
    name: l.texts[0]?.name ?? l.id,
    targetMuscle: l.primaryMuscles[0]
      ? (muscleName.get(l.primaryMuscles[0]) ?? null)
      : null,
    libraryId: l.id,
    exerciseType: l.exerciseType,
    machineId: autoMachine
      ? (machineByType.get(
          machineTypeFromLibrary(l.equipmentSlug, equipTags.get(l.equipmentSlug ?? "") ?? [])
        ) ?? null)
      : null,
  }));

  // 4) Batched insert.
  let added = 0;
  for (let i = 0; i < data.length; i += CHUNK) {
    const res = await db.exercise.createMany({
      data: data.slice(i, i + CHUNK),
      skipDuplicates: true,
    });
    added += res.count;
  }
  return { added, skipped };
}
