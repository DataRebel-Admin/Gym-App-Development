"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(1000),
  p256dh: z.string().min(1).max(500),
  auth: z.string().min(1).max(500),
});

/**
 * Registreer (of vernieuw) een web-push-abonnement voor het huidige apparaat.
 * Push-abonnementen zijn tenant-scoped; superadmins (zonder tenant) worden
 * overgeslagen. Idempotent via de unieke `endpoint`.
 */
export async function subscribeToPush(
  input: z.infer<typeof subscriptionSchema>
): Promise<{ ok: boolean }> {
  const session = await auth();
  const userId = session?.user?.id;
  const tenantId = session?.user?.tenantId;
  if (!userId || !tenantId) return { ok: false };

  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const { endpoint, p256dh, auth: authKey } = parsed.data;

  const h = await headers();
  const userAgent = h.get("user-agent")?.slice(0, 400) ?? null;

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { tenantId, userId, endpoint, p256dh, auth: authKey, userAgent },
    update: { tenantId, userId, p256dh, auth: authKey, userAgent },
  });

  return { ok: true };
}

/** Verwijder een web-push-abonnement (uitschakelen op dit apparaat). */
export async function unsubscribeFromPush(endpoint: string): Promise<{ ok: boolean }> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId || !endpoint) return { ok: false };

  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId } });
  return { ok: true };
}
