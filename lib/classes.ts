import "server-only";
import { prisma } from "@/lib/db";
import { isFeatureEnabled } from "@/lib/features/service";

/**
 * Is het lesrooster/aanmelden-voor-lessen aan voor deze tenant? Twee lagen:
 * 1. de Superadmin-feature-flag `group_classes` (masterschakelaar — module
 *    beschikbaar voor de sportschool?), en
 * 2. de owner-schakelaar `Tenant.classesEnabled` (fijnmazig, op /owner/settings).
 * Beide moeten aan staan. Uit verbergt alle les-UI en blokkeert in-/uitschrijven;
 * bestaande lessen/aanmeldingen blijven bewaard (heractiveren = toggle).
 *
 * Dé centrale resolver: alle les-call-sites (nav, pagina's, actions) gebruiken
 * deze functie zodat de feature-flag overal consistent geldt.
 */
export async function areClassesEnabled(tenantId: string): Promise<boolean> {
  const [flagOk, t] = await Promise.all([
    isFeatureEnabled(tenantId, "group_classes"),
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { classesEnabled: true },
    }),
  ]);
  return flagOk && (t?.classesEnabled ?? true);
}
