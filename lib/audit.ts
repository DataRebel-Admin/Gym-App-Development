import "server-only";
import { headers } from "next/headers";
import type { Prisma, Role, AuditStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { categoryFromAction } from "@/lib/audit-actions";

/**
 * Anonimiseert een IP-adres (AVG: geen volledig IP bewaren).
 * IPv4 → laatste octet 0 (1.2.3.4 → 1.2.3.0); IPv6 → eerste 4 groepen + ::.
 */
export function anonymizeIp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const ip = raw.split(",")[0].trim();
  if (!ip) return null;
  if (ip.includes(":")) {
    const groups = ip.split(":").filter(Boolean).slice(0, 4);
    return groups.length ? `${groups.join(":")}::` : null;
  }
  const parts = ip.split(".");
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
  return null;
}

/** Leest geanonimiseerd IP + user-agent uit de request-headers (best effort). */
async function captureClient(): Promise<{
  ipAddress: string | null;
  userAgent: string | null;
}> {
  try {
    const h = await headers();
    const ip = anonymizeIp(
      h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? null
    );
    const ua = h.get("user-agent");
    return { ipAddress: ip, userAgent: ua ? ua.slice(0, 400) : null };
  } catch {
    // Buiten request-scope (bv. een script) — geen client-info beschikbaar.
    return { ipAddress: null, userAgent: null };
  }
}

/**
 * Schrijf een audit-regel voor een beheertaak. Bewust zonder FK's (forensisch):
 * de log overleeft het verwijderen van tenants/gebruikers. `tenantId` null =
 * platform-niveau (bv. een tenant aanmaken).
 *
 * Faalt NOOIT hard: een fout in logging mag de onderliggende actie niet breken.
 */
export async function audit(
  action: string,
  opts: {
    actor: { id?: string | null; email?: string | null; role?: Role | null };
    tenantId?: string | null;
    targetType?: string;
    targetId?: string;
    status?: AuditStatus;
    oldValue?: Prisma.InputJsonValue;
    newValue?: Prisma.InputJsonValue;
    metadata?: Prisma.InputJsonValue;
    /** Overschrijf de auto-capture (bv. vanuit een script). */
    ipAddress?: string | null;
    userAgent?: string | null;
  }
): Promise<void> {
  try {
    const client =
      opts.ipAddress !== undefined || opts.userAgent !== undefined
        ? { ipAddress: opts.ipAddress ?? null, userAgent: opts.userAgent ?? null }
        : await captureClient();

    await prisma.auditLog.create({
      data: {
        action,
        category: categoryFromAction(action),
        status: opts.status ?? "SUCCESS",
        actorId: opts.actor.id ?? null,
        actorEmail: opts.actor.email ?? null,
        actorRole: opts.actor.role ?? null,
        tenantId: opts.tenantId ?? null,
        targetType: opts.targetType,
        targetId: opts.targetId,
        oldValue: opts.oldValue,
        newValue: opts.newValue,
        ipAddress: client.ipAddress,
        userAgent: client.userAgent,
        metadata: opts.metadata,
      },
    });
  } catch (err) {
    console.error(`[audit] kon actie "${action}" niet loggen:`, err);
  }
}
