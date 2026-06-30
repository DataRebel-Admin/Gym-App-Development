"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOwner } from "@/lib/owner";
import { audit } from "@/lib/audit";
import {
  STAFF_CONFIGURABLE_PERMISSIONS,
  type Permission,
  type PermissionOverrides,
} from "@/lib/rbac";

const CONFIGURABLE = new Set<string>(STAFF_CONFIGURABLE_PERMISSIONS);

/**
 * Zet de permissie-override van één medewerker. De ingediende (aangevinkte)
 * permissies bepalen wat AAN staat; al het overige (toewijsbare) staat expliciet
 * uit. Alleen toewijsbare feature-permissies kunnen worden gezet — beheer-
 * permissies blijven exclusief voor de eigenaar.
 */
export async function setStaffPermissions(formData: FormData) {
  const owner = await requireOwner();

  const userId = z.string().min(1).safeParse(formData.get("userId"));
  if (!userId.success) return;

  const submitted = formData
    .getAll("permissions")
    .map(String)
    .filter((p) => CONFIGURABLE.has(p));

  const overrides: PermissionOverrides = {};
  for (const perm of STAFF_CONFIGURABLE_PERMISSIONS) {
    overrides[perm as Permission] = submitted.includes(perm);
  }

  // Uitsluitend medewerkers van de eigen tenant; nooit een admin/lid.
  const target = await prisma.user.findFirst({
    where: { id: userId.data, tenantId: owner.tenantId, role: "TENANT_STAFF" },
    select: { id: true, email: true },
  });
  if (!target) return;

  await prisma.user.update({
    where: { id: target.id },
    data: { permissions: overrides },
  });

  await audit("user.permissions.change", {
    actor: owner,
    tenantId: owner.tenantId,
    targetType: "User",
    targetId: target.id,
    metadata: { email: target.email, permissions: overrides },
  });

  revalidatePath("/owner/staff");
}
