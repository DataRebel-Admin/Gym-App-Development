import "server-only";
import { prisma } from "@/lib/db";
import { isFeatureEnabled } from "@/lib/features/service";

/**
 * Effectief "AI aan" voor een tenant. Twee lagen (beide moeten aan):
 * 1. de Superadmin-feature-flag `ai` (masterschakelaar — is de AI-module
 *    überhaupt beschikbaar voor deze sportschool?), en
 * 2. de owner-schakelaar `Tenant.aiEnabled` (op /owner/settings).
 *
 * Dé centrale resolver voor álle AI-oppervlakken (widget, coach-kaarten, gate in
 * de orchestrator). Los van of er een API-sleutel is (`aiConfigured()`): zonder
 * sleutel degradeert de UI netjes met een melding.
 */
export async function isAiEnabled(tenantId: string): Promise<boolean> {
  const [flagOk, t] = await Promise.all([
    isFeatureEnabled(tenantId, "ai"),
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { aiEnabled: true },
    }),
  ]);
  return flagOk && (t?.aiEnabled ?? false);
}
