"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getTenantLocations } from "@/lib/locations";
import { setActiveLocationCookie } from "@/lib/location-resolve";
import { audit } from "@/lib/audit";

/**
 * Kies de actieve vestiging voor dit apparaat (device-cookie, zie
 * lib/location-resolve.ts). Voor élke ingelogde tenant-gebruiker (lid start er
 * z'n sessies mee; een trainer registreert er PT-sessies mee). Server-side
 * gevalideerd: alleen een actieve vestiging van de eigen tenant is kiesbaar.
 */
export async function setActiveLocation(locationId: string): Promise<{ ok: boolean }> {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || !user.tenantId) return { ok: false };

  const parsed = z.string().min(1).max(64).safeParse(locationId);
  if (!parsed.success) return { ok: false };

  const locations = await getTenantLocations(user.tenantId);
  const location = locations.find((l) => l.id === parsed.data);
  if (!location) return { ok: false };

  await setActiveLocationCookie(location.id);
  await audit("user.location.switch", {
    actor: user,
    tenantId: user.tenantId,
    locationId: location.id,
    metadata: { name: location.name },
  });
  revalidatePath("/member/schema");
  revalidatePath("/member");
  return { ok: true };
}
