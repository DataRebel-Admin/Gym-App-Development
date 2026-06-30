import "server-only";
import bcrypt from "bcryptjs";
import { generateSecret, generateURI, verifySync } from "otplib";

export async function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 12);
}

export async function verifyPassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw, hash);
}

/** Nieuw base32 TOTP-secret. */
export function newTotpSecret(): string {
  return generateSecret();
}

/** otpauth:// URI voor de QR-code in de authenticator-app. */
export function totpUri(email: string, secret: string): string {
  return generateURI({ issuer: "GymRebel", label: email, secret });
}

/** Verifieer een 6-cijferige TOTP-code (met kleine tijdsmarge van ±30s). */
export function verifyTotp(token: string, secret: string): boolean {
  try {
    return verifySync({ secret, token: token.replace(/\s/g, ""), epochTolerance: 30 }).valid;
  } catch {
    return false;
  }
}
