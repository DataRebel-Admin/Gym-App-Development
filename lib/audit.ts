import "server-only";
import type { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * Schrijf een audit-regel voor een beheertaak. Bewust zonder FK's (forensisch):
 * de log overleeft het verwijderen van tenants/gebruikers. `tenantId` null =
 * platform-niveau (bv. een tenant aanmaken).
 */
export async function audit(
  action: string,
  opts: {
    actor: { id?: string | null; email?: string | null; role?: Role | null };
    tenantId?: string | null;
    targetType?: string;
    targetId?: string;
    metadata?: Prisma.InputJsonValue;
  }
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      action,
      actorId: opts.actor.id ?? null,
      actorEmail: opts.actor.email ?? null,
      actorRole: opts.actor.role ?? null,
      tenantId: opts.tenantId ?? null,
      targetType: opts.targetType,
      targetId: opts.targetId,
      metadata: opts.metadata,
    },
  });
}
