import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { cookies, headers } from "next/headers";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import { appBaseUrl } from "@/lib/app-url";
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/types";

/**
 * Passkey/WebAuthn-kern (biometrische login) op basis van @simplewebauthn v9.
 *
 * Bewust GEEN Auth.js WebAuthn-provider: die is experimenteel en botst met onze
 * sterk aangepaste, tenant-scoped auth. Deze laag genereert/verifieert de
 * ceremonies; de sessie wordt daarna gemint via de bestaande credentials+challenge
 * (zie lib/login-complete.ts). Een geverifieerde passkey resolvet de credential →
 * exact één User (met tenantId), dus login is subdomein- én gym-kiezer-vrij.
 *
 * De WebAuthn-challenge wordt tussen begin/finish bewaard in een getekende,
 * kortlevende httpOnly-cookie (HMAC met AUTH_SECRET).
 */

const CHALLENGE_COOKIE = "gymrebel-passkey-challenge";
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

function secret(): string {
  const s = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET ontbreekt, vereist voor passkeys.");
  return s;
}
function sign(body: string): string {
  return createHmac("sha256", secret()).update(body).digest("base64url");
}

/** rpID/origin/rpName. Basis is de app-host (lib/app-url.ts, dus `APP_BASE_URL`
 *  → `AUTH_URL` → `NEXTAUTH_URL`); override via WEBAUTHN_RP_ID. Bewust niet
 *  rechtstreeks op AUTH_URL: die mag leegblijven zodat NextAuth de origin uit
 *  de request afleidt, en dan zou dit stil op localhost uitkomen.
 *
 *  **rpID = het basisdomein, niet de app-host.** Leden zitten op hun
 *  gym-subdomein (`gymrebel.gymrebel-training.com`); een rpID van
 *  `app.gymrebel-training.com` is daar geen registrable suffix en de browser
 *  weigert de hele ceremonie dan met een SecurityError (zo faalde elke
 *  registratie vanaf een tenant-subdomein). Met het basisdomein als rpID werkt
 *  één passkey op álle subdomeinen. Buiten het basisdomein (localhost,
 *  previews) valt hij terug op de host zelf. */
export function rpConfig(): { rpID: string; origin: string; rpName: string } {
  const url = new URL(appBaseUrl());
  const base = (process.env.NEXT_PUBLIC_APP_DOMAIN ?? "gymrebel-training.com").toLowerCase();
  const host = url.hostname.toLowerCase();
  const derived = host === base || host.endsWith(`.${base}`) ? base : host;
  return {
    rpID: process.env.WEBAUTHN_RP_ID ?? derived,
    origin: url.origin,
    rpName: "GymRebel",
  };
}

/** Origins die een ceremonie mag dragen: de app-host én de host van dít
 *  request (het gym-subdomein waar het lid daadwerkelijk zit). De Host-header
 *  is te vertrouwen: alleen domeinen die naar deze deployment routeren komen
 *  hier binnen, en de clientDataJSON-origin moet er exact aan gelijk zijn. */
async function expectedOrigins(): Promise<string[]> {
  const { origin } = rpConfig();
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  const origins = [origin];
  if (host) origins.push(`${proto}://${host}`);
  return [...new Set(origins)];
}

type ChallengePayload = { c: string; u?: string; exp: number };

async function setChallengeCookie(data: { c: string; u?: string }): Promise<void> {
  const payload: ChallengePayload = { ...data, exp: Date.now() + CHALLENGE_TTL_MS };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const token = `${body}.${sign(body)}`;
  (await cookies()).set(CHALLENGE_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: CHALLENGE_TTL_MS / 1000,
  });
}

async function readChallengeCookie(): Promise<ChallengePayload | null> {
  const token = (await cookies()).get(CHALLENGE_COOKIE)?.value;
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const given = Buffer.from(sig);
  const want = Buffer.from(sign(body));
  if (given.length !== want.length || !timingSafeEqual(given, want)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as ChallengePayload;
    if (typeof data.c !== "string" || typeof data.exp !== "number" || data.exp < Date.now()) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

async function clearChallengeCookie(): Promise<void> {
  (await cookies()).delete(CHALLENGE_COOKIE);
}

export type StoredCredential = { credentialId: string; transports: string[] };

/** Registratie-ceremonie starten (ingelogde gebruiker). */
export async function beginRegistration(
  user: { id: string; email: string; name?: string | null },
  existing: StoredCredential[]
): Promise<PublicKeyCredentialCreationOptionsJSON> {
  const { rpID, rpName } = rpConfig();
  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: user.id,
    userName: user.email,
    userDisplayName: user.name ?? user.email,
    attestationType: "none",
    excludeCredentials: existing.map((c) => ({
      id: isoBase64URL.toBuffer(c.credentialId),
      type: "public-key",
      transports: c.transports as AuthenticatorTransportFuture[],
    })),
    authenticatorSelection: {
      // BEWUST GEEN `authenticatorAttachment: "platform"` EN GEEN
      // `residentKey: "required"`. Die strengere eisen leken de juiste
      // "ontgrendel-zoals-je-telefoon"-ervaring af te dwingen, maar op Android
      // (derde-partij credential-providers naast Google Wachtwoordmanager)
      // faalde de héle ceremonie ermee: "NotReadableError: An unknown error
      // occured while talking to the credential manager" — terwijl dezelfde
      // telefoon met deze lossere opties (het webauthn.io-profiel) gewoon
      // werkt. De Android-kiezer kiest standaard tóch de toestel-ontgrendeling
      // en GPM slaat passkeys altijd discoverable op, dus de usernameless
      // login blijft functioneren. Niet weer aanscherpen zonder test op een
      // toestel met een niet-Google wachtwoordmanager.
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });
  await setChallengeCookie({ c: options.challenge, u: user.id });
  return options;
}

export type NewCredential = {
  credentialId: string;
  publicKey: string;
  counter: number;
  transports: string[];
  deviceType: string | null;
  backedUp: boolean;
};

/** Registratie-ceremonie afronden. Bindt aan de ingelogde user (challenge-cookie).
 *  Retourneert de op te slaan credential-velden, of null bij mislukking. */
export async function finishRegistration(
  userId: string,
  response: RegistrationResponseJSON
): Promise<NewCredential | null> {
  const stored = await readChallengeCookie();
  await clearChallengeCookie();
  if (!stored || stored.u !== userId) return null;

  const { rpID } = rpConfig();
  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: stored.c,
      expectedOrigin: await expectedOrigins(),
      expectedRPID: rpID,
      requireUserVerification: false,
    });
  } catch {
    return null;
  }
  if (!verification.verified || !verification.registrationInfo) return null;

  const info = verification.registrationInfo;
  return {
    credentialId: isoBase64URL.fromBuffer(info.credentialID),
    publicKey: isoBase64URL.fromBuffer(info.credentialPublicKey),
    counter: info.counter,
    transports: response.response.transports ?? [],
    deviceType: info.credentialDeviceType ?? null,
    backedUp: info.credentialBackedUp,
  };
}

/** Authenticatie-ceremonie starten (usernameless/discoverable — geen allowCredentials). */
export async function beginAuthentication(): Promise<PublicKeyCredentialRequestOptionsJSON> {
  const { rpID } = rpConfig();
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "preferred",
  });
  await setChallengeCookie({ c: options.challenge });
  return options;
}

export type StoredAuthenticator = {
  credentialId: string;
  publicKey: string;
  counter: number;
  transports: string[];
};

/** Authenticatie-ceremonie afronden tegen een opgeslagen credential.
 *  Retourneert de nieuwe teller, of null bij mislukking. */
export async function finishAuthentication(
  response: AuthenticationResponseJSON,
  record: StoredAuthenticator
): Promise<{ newCounter: number } | null> {
  const stored = await readChallengeCookie();
  await clearChallengeCookie();
  if (!stored) return null;

  const { rpID } = rpConfig();
  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: stored.c,
      expectedOrigin: await expectedOrigins(),
      expectedRPID: rpID,
      requireUserVerification: false,
      authenticator: {
        credentialID: isoBase64URL.toBuffer(record.credentialId),
        credentialPublicKey: isoBase64URL.toBuffer(record.publicKey),
        counter: record.counter,
        transports: record.transports as AuthenticatorTransportFuture[],
      },
    });
  } catch {
    return null;
  }
  if (!verification.verified) return null;
  return { newCounter: verification.authenticationInfo.newCounter };
}
