import "server-only";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePermission, type TenantUser } from "@/lib/staff";
import { trainedMemberWhere } from "@/lib/trainer-scope";

export type TrainedMember = {
  id: string;
  email: string;
  name: string | null;
  tenantId: string;
};

export type TrainerContext = {
  trainer: TenantUser;
  member: TrainedMember;
};

/**
 * Autorisatie-poort voor de trainer-gedreven trainingsflow (een medewerker/PT
 * draait een workout namens een lid). Vereist `schemas:manage` én dwingt af dat
 * `memberId` een **actief lid van de eigen tenant** is — de tenant komt altijd uit
 * de sessie van de trainer, nooit uit client-input. Zo kan een trainer van gym A
 * nooit een sessie starten/loggen voor een lid van gym B (cross-tenant → 404).
 *
 * De sessie blijft toegewezen aan het lid (`userId`); de trainer wordt vastgelegd
 * als `conductedById` (attributie/audit). Trofeeën/stats tellen als het lid.
 */
export async function resolveTrainedMember(memberId: string): Promise<TrainerContext> {
  const trainer = await requirePermission("schemas:manage");

  const member = await prisma.user.findFirst({
    // tenantId komt uit de trainer-sessie — nooit uit client-input (tenant-isolatie).
    where: trainedMemberWhere(memberId, trainer.tenantId),
    select: { id: true, email: true, name: true },
  });
  if (!member) notFound();

  // tenantId is per de filter gelijk aan de (gegarandeerd niet-null) trainer-tenant.
  return { trainer, member: { ...member, tenantId: trainer.tenantId } };
}
