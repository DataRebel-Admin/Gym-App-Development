"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";

async function currentUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

/** Markeer alle eigen ongelezen meldingen als gelezen. */
export async function markAllNotificationsRead(): Promise<void> {
  const userId = await currentUserId();
  if (!userId) return;
  await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}

/** Markeer één eigen melding als gelezen (no-op als ze niet van jou is). */
export async function markNotificationRead(notificationId: string): Promise<void> {
  const userId = await currentUserId();
  if (!userId || !notificationId) return;
  await prisma.notification.updateMany({
    where: { id: notificationId, userId, readAt: null },
    data: { readAt: new Date() },
  });
}
