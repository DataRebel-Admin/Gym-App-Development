import type { Prisma } from "@prisma/client";

/**
 * Pure Prisma-`where` voor het opzoeken van een lid binnen de scope van een
 * trainer: uitsluitend een **actief lid van de opgegeven tenant**. De `tenantId`
 * komt altijd uit de sessie van de trainer (zie `resolveTrainedMember`), nooit uit
 * client-input — daardoor kan een trainer van gym A nooit een lid van gym B
 * raken. Bewust puur (geen server-imports) zodat deze isolatie los testbaar is.
 */
export function trainedMemberWhere(
  memberId: string,
  tenantId: string
): Prisma.UserWhereInput {
  return { id: memberId, tenantId, role: "TENANT_MEMBER", active: true };
}
