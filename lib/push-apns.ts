import "server-only";
import type { ApnsClient } from "apns2";
import { prisma } from "@/lib/db";
import type { PushPayload } from "@/lib/push";

/**
 * Native iOS-push via APNs (apns2, HTTP/2 + JWT). Tegenhanger van lib/push.ts
 * (web-push): best-effort, faalt nooit hard. Zonder APNs-config degradeert alles
 * naar een no-op (`apnsConfigured()` = false).
 *
 * Benodigde env (Apple Developer → Keys → APNs Auth Key .p8):
 *   APNS_TEAM_ID, APNS_KEY_ID, APNS_PRIVATE_KEY (inhoud van de .p8, met \n),
 *   APNS_BUNDLE_ID (= app-topic, bv. app.gymrebel.mobile),
 *   APNS_PRODUCTION ("true" = api.push.apple.com, anders sandbox).
 *
 * apns2 staat in serverExternalPackages (next.config.ts) — niet bundelen.
 */
const TEAM = process.env.APNS_TEAM_ID ?? "";
const KEY_ID = process.env.APNS_KEY_ID ?? "";
// Sta zowel echte newlines als ge-escapete "\n" (één-regel-env) toe.
const KEY = (process.env.APNS_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");
const TOPIC = process.env.APNS_BUNDLE_ID ?? process.env.CAPACITOR_APP_ID ?? "";
const PRODUCTION = process.env.APNS_PRODUCTION === "true";

/** Is APNs geconfigureerd? */
export function apnsConfigured(): boolean {
  return Boolean(TEAM && KEY_ID && KEY && TOPIC);
}

let clientPromise: Promise<ApnsClient | null> | null = null;

async function getClient(): Promise<ApnsClient | null> {
  if (!apnsConfigured()) return null;
  if (!clientPromise) {
    clientPromise = (async () => {
      try {
        const { ApnsClient, Host } = await import("apns2");
        return new ApnsClient({
          team: TEAM,
          keyId: KEY_ID,
          signingKey: KEY,
          defaultTopic: TOPIC,
          host: PRODUCTION ? Host.production : Host.development,
        });
      } catch (err) {
        console.error("[apns] init mislukt:", (err as Error).message);
        return null;
      }
    })();
  }
  return clientPromise;
}

/** Dode tokens waarvoor we het abonnement mogen opruimen. */
const DEAD_REASONS = new Set(["BadDeviceToken", "Unregistered", "DeviceTokenNotForTopic"]);

/**
 * Verstuur een push naar alle iOS-apparaten van een gebruiker. Ruimt dode tokens
 * op. Retourneert het aantal bezorgde pushes. No-op (0) zonder APNs-config.
 */
export async function sendApnsToUser(userId: string, payload: PushPayload): Promise<number> {
  if (!apnsConfigured()) return 0;

  const tokens = await prisma.nativePushToken.findMany({
    where: { userId, platform: "ios" },
    select: { id: true, token: true },
  });
  if (tokens.length === 0) return 0;

  const client = await getClient();
  if (!client) return 0;

  const { Notification } = await import("apns2");
  let delivered = 0;
  const dead: string[] = [];

  await Promise.all(
    tokens.map(async (t) => {
      try {
        await client.send(
          new Notification(t.token, {
            alert: { title: payload.title, body: payload.body },
            sound: "default",
            topic: TOPIC,
            collapseId: payload.tag,
            data: payload.url ? { url: payload.url } : {},
          })
        );
        delivered += 1;
      } catch (err) {
        const reason = (err as { reason?: string }).reason;
        if (reason && DEAD_REASONS.has(reason)) dead.push(t.id);
        else console.error("[apns] verzending mislukt:", (err as Error).message);
      }
    })
  );

  if (dead.length > 0) {
    await prisma.nativePushToken.deleteMany({ where: { id: { in: dead } } }).catch(() => {});
  }

  return delivered;
}
