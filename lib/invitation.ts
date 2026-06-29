import "server-only";
import { randomBytes } from "node:crypto";

/** 32-hex-karakter uitnodigingstoken. */
export function inviteToken(): string {
  return randomBytes(16).toString("hex");
}

/** Vervaldatum: 7 dagen vanaf nu. */
export function inviteExpiry(): Date {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
}

/**
 * Verstuur de uitnodigingsmail. In development naar de server-console (net als
 * de magic link); productie hangt hier later een echte SMTP/Resend-transport in.
 */
export async function sendInviteEmail(opts: {
  email: string;
  tenantName: string;
  acceptUrl: string;
}): Promise<void> {
  console.log(
    "\n✉️  [GymRebel] Uitnodiging voor " +
      opts.email +
      " (" +
      opts.tenantName +
      "):\n" +
      opts.acceptUrl +
      "\n"
  );
}
