import "server-only";
import webpush from "web-push";
import { prisma } from "@/lib/db";
import { sendApnsToUser, apnsConfigured } from "@/lib/push-apns";
import { sendFcmToUser, fcmConfigured } from "@/lib/push-fcm";
import type { PushChannelCategory } from "@/lib/push-channels";

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
const SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:support@gymrebel-training.com";

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

/**
 * Kan native push op dit platform daadwerkelijk iets bezorgen?
 *
 * Gebruikt door `NativePushRegister` om te beslissen of registratie überhaupt
 * geprobeerd wordt. Twee redenen:
 *
 * 1. **Android crasht anders.** `PushNotifications.register()` roept
 *    `FirebaseMessaging.getInstance()` aan; zonder `google-services.json` in de
 *    APK gooit dat `IllegalStateException: Default FirebaseApp is not
 *    initialized`. Die uitzondering ontstaat native op de CapacitorPlugins-thread
 *    en is dus **niet** te vangen met een try/catch in JavaScript: het proces
 *    gaat eraan. Precies dát gebeurde bij het toestaan van meldingen.
 * 2. **Anders vraag je toestemming voor niets.** Zonder verzendconfiguratie komt
 *    er nooit een melding aan, en een permissievraag die nergens toe leidt kost
 *    je alleen goodwill (en een "nee" die je later niet meer omgedraaid krijgt).
 *
 * ⚠️ **Volgorde bij het inrichten van Android-push:** eerst
 * `google-services.json` in `android/app/` en de app opnieuw bouwen, pas daarna
 * de `FCM_*`-variabelen op de server. Andersom gaat deze vlag open terwijl de
 * geïnstalleerde APK nog geen Firebase heeft, en dan is de crash terug.
 */
export function nativePushConfigured(): { ios: boolean; android: boolean } {
  return { ios: apnsConfigured(), android: fcmConfigured() };
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
  /**
   * Meldingscategorie. Bepaalt op Android in welk **kanaal** de melding valt en
   * daarmee of hij met geluid binnenkomt of stil in de balk verschijnt (zie
   * lib/push-channels.ts). Optioneel: zonder categorie gebruikt Android het
   * standaardkanaal.
   *
   * Dit is bewust een apart veld en niet afgeleid uit `tag`: die tags zijn
   * bedoeld om meldingen te vervangen en lopen niet gelijk met de categorieën
   * ("achievement" versus "achievements", "schema-assigned" versus "schemas").
   */
  category?: PushChannelCategory;
};

/**
 * Verstuur een push naar álle apparaten van een gebruiker — web-push (VAPID) én
 * native iOS (APNs). Ruimt verlopen web-abonnementen (404/410) en dode APNs-tokens
 * op. Retourneert het totaal aantal bezorgde pushes. Best-effort: elk kanaal
 * degradeert los naar 0 zonder config.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<number> {
  let delivered = 0;

  // Web-push (VAPID) — alleen als geconfigureerd.
  if (configured) {
    const subs = await prisma.pushSubscription.findMany({ where: { userId } });
    if (subs.length > 0) {
      const body = JSON.stringify(payload);
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
    }
  }

  // Native iOS (APNs) — onafhankelijk van de web-push-config; best-effort.
  try {
    delivered += await sendApnsToUser(userId, payload);
  } catch (err) {
    console.error("[push] APNs mislukt:", (err as Error).message);
  }

  // Native Android (FCM) — idem. Nodig omdat de Capacitor-WebView géén
  // service-worker-push ontvangt: web-push hierboven bereikt alleen browsers en
  // geïnstalleerde PWA's, niet de app uit de Play Store.
  try {
    delivered += await sendFcmToUser(userId, payload);
  } catch (err) {
    console.error("[push] FCM mislukt:", (err as Error).message);
  }

  return delivered;
}
