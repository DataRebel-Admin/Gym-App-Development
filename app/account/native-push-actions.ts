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

/**
 * Trek een device-token in. Aangeroepen door de app zodra er niemand meer is
 * ingelogd (zie `components/pwa/native-push-cleanup.tsx`).
 *
 * ## Waarom dit moet
 *
 * Het token hoort bij het *toestel*, niet bij de sessie. Zonder intrekken blijft
 * een uitgelogd toestel meldingen van het vorige account tonen: log uit, geef je
 * telefoon aan iemand anders en die leest op het vergrendelscherm mee dat jouw
 * coach een nieuw schema heeft klaargezet.
 *
 * ## Waarom er geen sessie vereist is
 *
 * Bij uitloggen bestaat de sessie per definitie niet meer, dus een `auth()`-check
 * zou de opruiming juist onmogelijk maken. Verwijderen op tokenwaarde is veilig:
 * dat token is een apparaatgeheim dat alleen op dat toestel bekend is, en het
 * ergste wat een aanvaller met een gegokt token kan doen is meldingen voor
 * zichzelf uitzetten. Zelfde afweging als bij het afmelden van een web-push-
 * abonnement.
 */
export async function unregisterNativePushToken(token: string): Promise<{ ok: boolean }> {
  const parsed = z.string().min(1).max(400).safeParse(token);
  if (!parsed.success) return { ok: false };

  await prisma.nativePushToken.deleteMany({ where: { token: parsed.data } }).catch(() => {});

  return { ok: true };
}
