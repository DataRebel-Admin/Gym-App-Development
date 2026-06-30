"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOwner } from "@/lib/owner";
import { audit } from "@/lib/audit";

/** Zet de AI-assistent aan of uit voor de tenant van de owner. */
export async function setAiEnabled(formData: FormData) {
  const owner = await requireOwner();
  const enabled = formData.get("enabled") === "true";

  const before = await prisma.tenant.findUnique({
    where: { id: owner.tenantId },
    select: { aiEnabled: true },
  });

  await prisma.tenant.update({
    where: { id: owner.tenantId },
    data: { aiEnabled: enabled },
  });

  await audit("tenant.settings.update", {
    actor: owner,
    tenantId: owner.tenantId,
    targetType: "Tenant",
    targetId: owner.tenantId,
    oldValue: { aiEnabled: before?.aiEnabled ?? null },
    newValue: { aiEnabled: enabled },
    metadata: { setting: "aiEnabled" },
  });

  revalidatePath("/owner/settings");
}
