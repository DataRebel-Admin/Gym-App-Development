"use server";

import { prisma } from "@/lib/db";
import { requireOwner } from "@/lib/owner";
import { dashboardLayoutSchema, normalizeLayout } from "@/lib/dashboard";

/**
 * Slaat de persoonlijke dashboard-indeling van de owner op (volgorde +
 * zichtbaarheid). Gescoped op de ingelogde gebruiker; geen revalidate nodig
 * omdat de client de layout optimistisch bijhoudt.
 */
export async function saveDashboardLayout(
  layout: unknown
): Promise<{ ok: boolean }> {
  const owner = await requireOwner();
  const parsed = dashboardLayoutSchema.safeParse(layout);
  if (!parsed.success) return { ok: false };

  await prisma.user.update({
    where: { id: owner.id },
    data: { dashboardLayout: normalizeLayout(parsed.data) },
  });
  return { ok: true };
}
