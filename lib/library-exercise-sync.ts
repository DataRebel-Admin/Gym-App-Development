import "server-only";
import { prisma } from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant";
import { getContentLocale } from "@/lib/i18n/content-locale";
import { datasetLocalePreference } from "@/lib/exercise-library/mapping";
import { addLibraryExercisesToTenant } from "@/lib/exercise-library/tenant-sync";

/**
 * Zorg dat élke opgegeven RepDB-oefening (slug = LibraryExercise.id) als
 * tenant-Exercise bestaat en lever de mapping slug → Exercise.id.
 *
 * Geëxtraheerd uit `importLibraryTemplate` (app/owner/schemas/actions.ts) zodat
 * ook de lid-catalogus (week-/dag-templates overnemen) hetzelfde pad gebruikt.
 * Het aanmaken zelf loopt via de gedeelde kern `addLibraryExercisesToTenant`
 * (naam uit de **en**-tekstrij, spier-snapshot in de taal van de lezer,
 * `exerciseType` uit de import-inferentie, bestaande koppelingen overgeslagen).
 *
 * Onbekende slugs (niet in de bibliotheek, of geretireerd zonder tenant-rij)
 * ontbreken simpelweg in de resultaat-map — de aanroeper slaat die items over
 * (best-effort, zelfde gedrag als de owner-import).
 */
export async function ensureLibraryExercises(
  tenantId: string,
  slugs: string[]
): Promise<Map<string, string>> {
  const unique = [...new Set(slugs)];
  if (unique.length === 0) return new Map();

  const existing = await prisma.exercise.findMany({
    where: { tenantId, libraryId: { in: unique } },
    select: { id: true, libraryId: true },
  });
  const bySlug = new Map(existing.map((e) => [e.libraryId as string, e.id]));
  const missing = unique.filter((s) => !bySlug.has(s));
  if (missing.length === 0) return bySlug;

  const { added } = await addLibraryExercisesToTenant(prisma, tenantId, {
    ids: missing,
    localePref: datasetLocalePreference(
      await getContentLocale((await getCurrentTenant())?.locale)
    ),
  });
  if (added === 0) return bySlug;

  const created = await prisma.exercise.findMany({
    where: { tenantId, libraryId: { in: missing } },
    select: { id: true, libraryId: true },
  });
  for (const e of created) bySlug.set(e.libraryId as string, e.id);
  return bySlug;
}

/**
 * Hoeveel van deze slugs zijn nieuw voor de sportschool? (Voor de catalogus-
 * detailweergave: "voegt N oefeningen toe die nieuw zijn voor jouw sportschool".)
 */
export async function countNewLibraryExercises(
  tenantId: string,
  slugs: string[]
): Promise<number> {
  const unique = [...new Set(slugs)];
  if (unique.length === 0) return 0;
  const owned = await prisma.exercise.count({
    where: { tenantId, libraryId: { in: unique } },
  });
  return unique.length - owned;
}
