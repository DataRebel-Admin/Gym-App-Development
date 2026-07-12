import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
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
  if (!s) throw new Error("AUTH_SECRET ontbreekt — vereist voor passkeys.");
  return s;
}
function sign(body: string): string {
  return createHmac("sha256", secret()).update(body).digest("base64url");
}

/** rpID/origin/rpName. rpID uit AUTH_URL-host; override via WEBAUTHN_RP_ID
 *  (bv. een registrable parent zoals "gymrebel.app" voor whitelabel-subdomeinen). */
export function rpConfig(): { rpID: string; origin: string; rpName: string } {
  const url = new URL(
    process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000"
  );
  return {
    rpID: process.env.WEBAUTHN_RP_ID ?? url.hostname,
    origin: url.origin,
    rpName: "GymRebel",
  };
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

  const { rpID, origin } = rpConfig();
  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: stored.c,
      expectedOrigin: origin,
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

  const { rpID, origin } = rpConfig();
  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: stored.c,
      expectedOrigin: origin,
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
