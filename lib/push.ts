import "server-only";
import webpush from "web-push";
import { prisma } from "@/lib/db";

/**
 * Web-push-verzending (VAPID). Centrale, best-effort laag — net als
 * lib/email/send.ts faalt push nooit hard: een verzendfout mag een
 * business-actie nooit breken.
 *
 * Zonder VAPID-sleutels (env) degradeert alles netjes: `pushConfigured()` is
 * false en verzenden is een no-op. Genereer sleutels lokaal met:
 *   npx web-push generate-vapid-keys
 * en zet ze in .env (zie .env.example).
 */
const PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY ?? "";
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? "";
const SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:support@gymrebel.app";

let configured = false;
if (PUBLIC_KEY && PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY);
    configured = true;
  } catch (err) {
    console.error("[push] ongeldige VAPID-configuratie:", err);
  }
}

/** Is web-push geconfigureerd (VAPID-sleutels aanwezig)? */
export function pushConfigured(): boolean {
  return configured;
}

/** Publieke VAPID-sleutel voor de client (subscribe). Leeg = niet geconfigureerd. */
export function vapidPublicKey(): string {
  return configured ? PUBLIC_KEY : "";
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

/**
 * Verstuur een push naar álle apparaten van een gebruiker. Ruimt verlopen
 * abonnementen op (HTTP 404/410). Retourneert het aantal succesvol bezorgde
 * pushes. No-op (0) zonder VAPID-config.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<number> {
  if (!configured) return 0;

  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subs.length === 0) return 0;

  const body = JSON.stringify(payload);
  let delivered = 0;
  const expired: string[] = [];

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body
        );
        delivered += 1;
      } catch (err) {
        const code = (err as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) {
          expired.push(s.id);
        } else {
          console.error("[push] verzending mislukt:", (err as Error).message);
        }
      }
    })
  );

  if (expired.length > 0) {
    await prisma.pushSubscription
      .deleteMany({ where: { id: { in: expired } } })
      .catch(() => {});
  }

  return delivered;
}
