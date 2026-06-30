"use server";

import { z } from "zod";
import QRCode from "qrcode";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { auth, signOut } from "@/auth";
import { requireAccount } from "@/lib/account";
import { audit } from "@/lib/audit";
import { hashPassword, verifyPassword, newTotpSecret, totpUri, verifyTotp } from "@/lib/security";
import { passwordStrength } from "@/lib/password-strength";
import { loadTenantBranding } from "@/lib/email/branding";
import { passwordChangedMessage } from "@/lib/email/messages";
import { sendEmail } from "@/lib/email/send";
import { prefAllows } from "@/lib/notifications";

async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export type SecurityState = { ok?: boolean; error?: string; qr?: string; secret?: string };

function actor(u: { id: string; email?: string | null; role: string; tenantId?: string | null }) {
  return { id: u.id, email: u.email ?? null, role: u.role as never };
}

const pwSchema = z.object({
  currentPassword: z.string().optional().or(z.literal("")),
  newPassword: z.string().min(8, "Minimaal 8 tekens"),
});

/** Wachtwoord instellen of wijzigen. Bestaand wachtwoord = herauth vereist. */
export async function setPassword(
  _prev: SecurityState,
  formData: FormData
): Promise<SecurityState> {
  const session = await requireAccount();
  const parsed = pwSchema.safeParse({
    currentPassword: formData.get("currentPassword") ?? "",
    newPassword: formData.get("newPassword") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ongeldige invoer" };

  if (!passwordStrength(parsed.data.newPassword).ok) {
    return { error: "Wachtwoord te zwak — gebruik 8+ tekens met variatie." };
  }

  const me = await prisma.user.findUnique({
    where: { id: session.id },
    select: { passwordHash: true, email: true, name: true, role: true, tenantId: true, notificationPrefs: true },
  });
  if (!me) return { error: "Account niet gevonden" };

  // Herauthenticatie: bestaand wachtwoord moet kloppen.
  if (me.passwordHash) {
    const ok = parsed.data.currentPassword
      ? await verifyPassword(parsed.data.currentPassword, me.passwordHash)
      : false;
    if (!ok) return { error: "Huidig wachtwoord onjuist" };
  }

  await prisma.user.update({
    where: { id: session.id },
    data: { passwordHash: await hashPassword(parsed.data.newPassword) },
  });
  await audit("password.change", {
    actor: actor({ id: session.id, email: me.email, role: me.role, tenantId: me.tenantId }),
    tenantId: me.tenantId ?? null,
    targetType: "User",
    targetId: session.id,
  });

  // Beveiligingsmelding (best-effort — breekt het opslaan niet). Respecteert de
  // meldingsvoorkeur (categorie: beveiliging); standaard staat e-mail aan.
  if (prefAllows(me.notificationPrefs, "security", "email")) {
    try {
      const branding = await loadTenantBranding(me.tenantId);
      await sendEmail({
        to: me.email,
        message: passwordChangedMessage({
          branding,
          recipientName: me.name,
          securityUrl: `${await origin()}/account/beveiliging`,
        }),
      });
    } catch (err) {
      console.error("✗ Wachtwoord-melding mislukt:", (err as Error).message);
    }
  }

  revalidatePath("/account/beveiliging");
  return { ok: true };
}

/** Start 2FA-setup: genereer secret + QR (nog niet ingeschakeld). */
export async function start2FA(
  _prev?: SecurityState,
  _formData?: FormData
): Promise<SecurityState> {
  const session = await requireAccount();
  const secret = newTotpSecret();
  await prisma.user.update({
    where: { id: session.id },
    data: { twoFactorSecret: secret, twoFactorEnabled: false },
  });
  const uri = totpUri(session.email ?? "gebruiker", secret);
  const qr = await QRCode.toDataURL(uri, { margin: 1, width: 200 });
  return { ok: true, qr, secret };
}

/** Bevestig 2FA met een code uit de authenticator-app. */
export async function confirm2FA(
  _prev: SecurityState,
  formData: FormData
): Promise<SecurityState> {
  const session = await requireAccount();
  const code = String(formData.get("code") ?? "");
  const me = await prisma.user.findUnique({
    where: { id: session.id },
    select: { twoFactorSecret: true, role: true, email: true, tenantId: true },
  });
  if (!me?.twoFactorSecret) return { error: "Start eerst de 2FA-instelling." };
  if (!verifyTotp(code, me.twoFactorSecret)) return { error: "Onjuiste code" };

  await prisma.user.update({ where: { id: session.id }, data: { twoFactorEnabled: true } });
  await audit("2fa.enabled", {
    actor: actor({ id: session.id, email: me.email, role: me.role, tenantId: me.tenantId }),
    tenantId: me.tenantId ?? null,
    targetType: "User",
    targetId: session.id,
  });
  revalidatePath("/account/beveiliging");
  return { ok: true };
}

/** Schakel 2FA uit. */
export async function disable2FA() {
  const session = await requireAccount();
  await prisma.user.update({
    where: { id: session.id },
    data: { twoFactorEnabled: false, twoFactorSecret: null },
  });
  await audit("2fa.disabled", {
    actor: actor({ id: session.id, email: session.email, role: session.role, tenantId: session.tenantId }),
    tenantId: session.tenantId ?? null,
    targetType: "User",
    targetId: session.id,
  });
  revalidatePath("/account/beveiliging");
}

/** Log uit op alle apparaten: ongeldig maken van bestaande sessies + nu uitloggen. */
export async function logoutAllDevices() {
  const session = await auth();
  if (!session?.user?.id) return;
  await prisma.user.update({
    where: { id: session.user.id },
    data: { sessionsValidFrom: new Date() },
  });
  await prisma.userSession.updateMany({
    where: { userId: session.user.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  await audit("sessions.revoke_all", {
    actor: { id: session.user.id, email: session.user.email ?? null, role: session.user.role },
    tenantId: session.user.tenantId ?? null,
    targetType: "User",
    targetId: session.user.id,
  });
  await signOut({ redirectTo: "/login" });
}
