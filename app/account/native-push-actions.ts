"use server";

import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

const schema = z.object({
  token: z.string().min(1).max(400),
  platform: z.enum(["ios", "android"]),
});

/**
 * Registreer een native push-device-token (APNs/FCM) voor de ingelogde gebruiker.
 * Wordt vanuit de Capacitor-app aangeroepen na `PushNotifications.register()`.
 * No-op zonder ingelogde tenant-gebruiker (superadmin heeft geen tenant → geen
 * native push). Idempotent via de unieke token (upsert).
 */
export async function registerNativePushToken(input: {
  token: string;
  platform: "ios" | "android";
}): Promise<{ ok: boolean }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false };

  const user = (await auth())?.user;
  if (!user?.id || !user.tenantId) return { ok: false };

  await prisma.nativePushToken
    .upsert({
      where: { token: parsed.data.token },
      create: {
        token: parsed.data.token,
        platform: parsed.data.platform,
        userId: user.id,
        tenantId: user.tenantId,
      },
      update: { userId: user.id, tenantId: user.tenantId, lastUsedAt: new Date() },
    })
    .catch(() => {});

  return { ok: true };
}
