import "server-only";
import { getLocale } from "next-intl/server";
import type { Locale as PrismaLocale } from "@prisma/client";
import { enumFromLocale, isLocale } from "@/lib/i18n/config";

/**
 * Taal voor **dataset-content** (oefening-instructies, spier-/materiaalnamen uit
 * de bibliotheek en de klassieke catalogus).
 *
 * De **UI-taal wint**, `tenant.locale` is alleen vangnet. Dat is bewust: sinds de
 * i18n-ronde volgt de hele interface (inclusief `<html lang>`) de UI-locale
 * (cookie `gymrebel-locale` → `Accept-Language` → NL), terwijl de oefeningteksten
 * nog op `tenant.locale` stonden. Een Nederlandstalig lid bij een tenant met
 * `locale = EN` (bv. de demo-sportschool ironhouse) kreeg daardoor een Nederlandse
 * interface met een Engelse "Uitvoering" — en omgekeerd. De taal van de teksten
 * hoort bij de lézer, niet bij de sportschool; `tenant.locale` blijft nuttig als
 * standaard voor wie nog geen voorkeur heeft (die zit al in de resolutie-keten van
 * `lib/i18n/request.ts`) en als vangnet buiten request-scope.
 *
 * Levert de Prisma `Locale`-enum zodat de bestaande resolvers
 * (`getExerciseDetail`, `getLibraryPreview`, `getCatalogPreview`,
 * `datasetLocalePreference`) hun signatuur houden.
 */
export async function getContentLocale(
  fallback?: PrismaLocale | null
): Promise<PrismaLocale> {
  // Buiten een request (scripts, tests) heeft next-intl geen context → vangnet.
  const ui = await getLocale().catch(() => null);
  return isLocale(ui) ? enumFromLocale(ui) : (fallback ?? "NL");
}
