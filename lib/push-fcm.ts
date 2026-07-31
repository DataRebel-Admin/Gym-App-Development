import "server-only";
import { createSign } from "node:crypto";
import { prisma } from "@/lib/db";
import type { PushPayload } from "@/lib/push";
import { channelIdFor } from "@/lib/push-channels";

/**
 * Native Android-push via **FCM HTTP v1**. Tegenhanger van lib/push-apns.ts
 * (iOS) en lib/push.ts (web-push): best-effort, faalt nooit hard. Zonder config
 * degradeert alles naar een no-op (`fcmConfigured()` = false).
 *
 * ## Waarom geen firebase-admin
 *
 * De hele integratie is één POST met een OAuth2-token. `firebase-admin` sleept
 * daar tientallen megabytes en een gRPC-stack voor mee, in een codebase die
 * bewust dependency-arm is (zie de eigen ZIP-writer in lib/qr-export/zip.ts).
 * Het access-token is een RS256-JWT die we met `node:crypto` ondertekenen en
 * inwisselen bij Google; dat is de volledige "SDK" die we nodig hebben.
 *
 * ## Benodigde env
 *
 * Firebase Console → Project settings → Service accounts → *Generate new private
 * key*. Uit die JSON:
 *   FCM_PROJECT_ID    = project_id
 *   FCM_CLIENT_EMAIL  = client_email
 *   FCM_PRIVATE_KEY   = private_key (PEM; \n mag ge-escaped in één env-regel)
 *
 * Aan de app-kant hoort daar `android/app/google-services.json` bij, uit
 * hetzelfde Firebase-project. Zonder dat bestand registreert de app geen token
 * en blijft dit stil een no-op.
 */
const PROJECT_ID = process.env.FCM_PROJECT_ID ?? "";
const CLIENT_EMAIL = process.env.FCM_CLIENT_EMAIL ?? "";
// Sta zowel echte newlines als ge-escapete "\n" toe (één-regel-env), net als APNs.
const PRIVATE_KEY = (process.env.FCM_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/firebase.messaging";

/** Is FCM geconfigureerd? */
export function fcmConfigured(): boolean {
  return Boolean(PROJECT_ID && CLIENT_EMAIL && PRIVATE_KEY);
}

function base64url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Bouwt de service-account-assertie: een RS256-JWT die Google inwisselt voor een
 * access token. Geldigheid bewust op 1 uur, het maximum dat Google accepteert.
 */
function buildAssertion(): string {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: CLIENT_EMAIL,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    })
  );
  const signature = createSign("RSA-SHA256")
    .update(`${header}.${claims}`)
    .sign(PRIVATE_KEY);
  return `${header}.${claims}.${base64url(signature)}`;
}

/**
 * Access-token-cache. Google geeft tokens van een uur uit; opnieuw ophalen bij
 * élke push zou een extra roundtrip per melding kosten. 60s marge zodat een
 * token nooit net tijdens de verzending verloopt.
 */
let cached: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string | null> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: buildAssertion(),
      }),
    });
    if (!res.ok) {
      console.error("[fcm] access token ophalen mislukt:", res.status, await res.text());
      return null;
    }
    const json = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!json.access_token) return null;
    cached = {
      token: json.access_token,
      expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
    };
    return cached.token;
  } catch (err) {
    console.error("[fcm] access token ophalen mislukt:", (err as Error).message);
    return null;
  }
}

/**
 * Foutcodes waarbij het token definitief dood is en we de rij mogen opruimen.
 * Alles daarbuiten (quota, netwerk, 5xx) is tijdelijk: dan het token laten staan,
 * anders verliest een gebruiker z'n meldingen door een storing bij Google.
 */
const DEAD_CODES = new Set(["UNREGISTERED", "INVALID_ARGUMENT", "SENDER_ID_MISMATCH"]);

type FcmError = {
  error?: { details?: { "@type"?: string; errorCode?: string }[]; message?: string };
};

/**
 * Verstuur een push naar alle Android-apparaten van een gebruiker. Ruimt dode
 * tokens op. Retourneert het aantal bezorgde pushes. No-op (0) zonder config.
 */
export async function sendFcmToUser(userId: string, payload: PushPayload): Promise<number> {
  if (!fcmConfigured()) return 0;

  const tokens = await prisma.nativePushToken.findMany({
    where: { userId, platform: "android" },
    select: { id: true, token: true },
  });
  if (tokens.length === 0) return 0;

  const accessToken = await getAccessToken();
  if (!accessToken) return 0;

  const url = `https://fcm.googleapis.com/v1/projects/${PROJECT_ID}/messages:send`;
  const channelId = channelIdFor(payload.category);
  let delivered = 0;
  const dead: string[] = [];

  await Promise.all(
    tokens.map(async (t) => {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: {
              token: t.token,
              notification: { title: payload.title, body: payload.body },
              // `data` komt binnen bij de pushNotificationActionPerformed-listener
              // in de app; daarmee navigeert de WebView naar de juiste pagina.
              ...(payload.url ? { data: { url: payload.url } } : {}),
              android: {
                priority: "HIGH",
                notification: {
                  // Kanaal bepaalt of de melding met geluid binnenkomt of stil in
                  // de balk verschijnt, én onder welke naam de gebruiker 'm in de
                  // systeeminstellingen kan uitzetten. Zie lib/push-channels.ts.
                  ...(channelId ? { channel_id: channelId } : {}),
                  // Zelfde tag = de nieuwe melding vervangt de vorige in plaats van
                  // te stapelen. Spiegelt `collapseId` aan de APNs-kant.
                  ...(payload.tag ? { tag: payload.tag } : {}),
                  sound: "default",
                  // Wit silhouet op transparant in `drawable-*`; Android gebruikt
                  // alleen het alfakanaal en kleurt zelf in met `color`. Zie de
                  // meta-data in AndroidManifest.xml voor het achtergrondgeval.
                  icon: "ic_stat_gymrebel",
                  color: "#FF4D00",
                },
              },
            },
          }),
        });

        if (res.ok) {
          delivered += 1;
          return;
        }

        const body = (await res.json().catch(() => ({}))) as FcmError;
        const code = body.error?.details?.find((d) => d.errorCode)?.errorCode;
        if (code && DEAD_CODES.has(code)) {
          dead.push(t.id);
        } else {
          console.error("[fcm] verzending mislukt:", res.status, code ?? body.error?.message ?? "");
        }
      } catch (err) {
        console.error("[fcm] verzending mislukt:", (err as Error).message);
      }
    })
  );

  if (dead.length > 0) {
    await prisma.nativePushToken.deleteMany({ where: { id: { in: dead } } }).catch(() => {});
  }

  return delivered;
}
