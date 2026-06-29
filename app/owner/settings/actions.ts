"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOwner } from "@/lib/owner";

/** Zet de AI-assistent aan of uit voor de tenant van de owner. */
export async function setAiEnabled(formData: FormData) {
  const owner = await requireOwner();
  const enabled = formData.get("enabled") === "true";

  await prisma.tenant.update({
    where: { id: owner.tenantId },
    data: { aiEnabled: enabled },
  });

  revalidatePath("/owner/settings");
}
