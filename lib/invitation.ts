import "server-only";
import { randomBytes } from "node:crypto";
import { loadTenantBranding } from "@/lib/email/branding";
import { inviteMessage } from "@/lib/email/messages";
import { sendEmail } from "@/lib/email/send";

/** 32-hex-karakter uitnodigingstoken. */
export function inviteToken(): string {
  return randomBytes(16).toString("hex");
}

/** Vervaldatum: 7 dagen vanaf nu. */
export function inviteExpiry(): Date {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
}

/**
 * Verstuur de uitnodigingsmail met de huisstijl van de tenant. Met Microsoft
 * Graph geconfigureerd gaat 'ie echt de deur uit; anders (dev) naar de
 * server-console — afgehandeld door `sendEmail`.
 */
export async function sendInviteEmail(opts: {
  email: string;
  tenantId: string;
  acceptUrl: string;
}): Promise<void> {
  const branding = await loadTenantBranding(opts.tenantId);
  await sendEmail({
    to: opts.email,
    message: inviteMessage({ branding, acceptUrl: opts.acceptUrl }),
    devLink: opts.acceptUrl,
  });
}
