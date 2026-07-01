"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireSuperadmin } from "@/lib/superadmin";
import { setFeatureFlag } from "@/lib/features/service";
import { FEATURE_KEYS } from "@/lib/features/catalog";
import { prisma } from "@/lib/db";

export type ToggleFeatureState = { ok?: boolean; error?: string };

const schema = z.object({
  tenantId: z.string().min(1),
  key: z.enum(FEATURE_KEYS as [string, ...string[]]),
  enabled: z.enum(["true", "false"]),
});

/**
 * Superadmin-only: zet een feature aan/uit voor een tenant. Direct actief
 * (RSC-revalidate, geen herstart). Logt de wijziging via `setFeatureFlag`.
 */
export async function toggleFeature(
  _prev: ToggleFeatureState,
  formData: FormData
): Promise<ToggleFeatureState> {
  const admin = await requireSuperadmin();

  const parsed = schema.safeParse({
    tenantId: formData.get("tenantId"),
    key: formData.get("key"),
    enabled: formData.get("enabled"),
  });
  if (!parsed.success) return { error: "Ongeldige invoer." };

  const { tenantId, key, enabled } = parsed.data;

  // Bestaat de tenant (en is 'ie niet verwijderd)?
  const tenant = await prisma.tenant.findFirst({
    where: { id: tenantId, deletedAt: null },
    select: { id: true },
  });
  if (!tenant) return { error: "Sportschool niet gevonden." };

  await setFeatureFlag(tenantId, key as (typeof FEATURE_KEYS)[number], enabled === "true", {
    id: admin.id,
    email: admin.email,
    role: admin.role,
  });

  revalidatePath("/admin/features");
  return { ok: true };
}
