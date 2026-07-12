import "server-only";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/security";
import { passwordMeetsPolicy, MIN_PASSWORD_LENGTH } from "@/lib/password-policy";
import { loadTenantBranding } from "@/lib/email/branding";
import { passwordResetMessage, passwordChangedMessage } from "@/lib/email/messages";
import { sendEmail } from "@/lib/email/send";
import { audit } from "@/lib/audit";
import { prefAllows, createInAppNotification } from "@/lib/notifications";

/**
 * Wachtwoord-reset via e-mail. Spiegelt het bestaande e-mailwijziging-token-
 * patroon (velden op `User`), maar dan pre-auth: eenmalige, kortlevende token in
 * een unieke kolom, gebruikt met de base `prisma` (net als de auth-adapter en de
 * verify-email-route — geen tenant-context, lookups op de unieke token).
 *
 * Beveiliging:
 *  - **Geen enumeratie**: `requestPasswordReset` geeft nooit prijs of een adres
 *    bestaat; het scherm toont altijd "check je mail".
 *  - **Multi-tenant**: e-mail is uniek *per tenant*, dus één adres kan bij
 *    meerdere sportscholen horen. We zetten per account-rij een eigen token en
 *    sturen per sportschool een gebrande mail (zoals de multi-gym magic link).
 *  - **Eenmalig**: de token wordt na gebruik genulld.
 *  - **Sessie-invalidatie**: na een reset worden alle bestaande sessies ongeldig
 *    (`sessionsValidFrom` + device-sessies revoked) → een eventuele aanvaller
 *    wordt uitgelogd.
 */

/** Geldigheidsduur van een reset-link (1 uur). */
const RESET_TTL_MS = 60 * 60 * 1000;

function resetToken(): string {
  return randomBytes(24).toString("hex");
}

/**
 * Verstuur een reset-link naar élk actief account van dit e-mailadres
 * (tenant-accounts + platform-superadmin). Faalt nooit hard en lekt geen bestaan
 * van accounts. Roep dit aan en toon daarna altijd het "check je mail"-scherm.
 */
export async function requestPasswordReset(
  emailRaw: string,
  origin: string
): Promise<void> {
  const email = emailRaw.toLowerCase().trim();
  if (!email) return;

  const users = await prisma.user.findMany({
    where: {
      email,
      active: true,
      OR: [
        { tenantId: null, role: "SUPERADMIN" },
        { tenant: { status: "ACTIVE", deletedAt: null } },
      ],
    },
    select: { id: true, email: true, name: true, role: true, tenantId: true, locale: true },
  });

  for (const user of users) {
    const token = resetToken();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: token,
        passwordResetExpires: new Date(Date.now() + RESET_TTL_MS),
      },
    });

    const url = `${origin}/login/reset/${token}`;
    try {
      const branding = await loadTenantBranding(user.tenantId);
      await sendEmail({
        to: user.email,
        message: await passwordResetMessage({
          branding,
          recipientName: user.name,
          resetUrl: url,
          locale: user.locale,
        }),
        devLink: url,
      });
    } catch (err) {
      console.error("✗ Wachtwoord-reset-mail mislukt:", (err as Error).message);
    }

    await audit("auth.password.reset.request", {
      actor: { id: user.id, email: user.email, role: user.role },
      tenantId: user.tenantId ?? null,
      targetType: "User",
      targetId: user.id,
    });
  }
}

export type ResetTokenInfo = { email: string; gymName: string };

/** Valideer een reset-token (bestaat + niet verlopen) voor de reset-pagina. */
export async function resolvePasswordResetToken(
  token: string
): Promise<ResetTokenInfo | null> {
  if (!token) return null;
  const user = await prisma.user.findUnique({
    where: { passwordResetToken: token },
    select: {
      email: true,
      passwordResetExpires: true,
      tenant: { select: { name: true } },
    },
  });
  if (!user || !user.passwordResetExpires || user.passwordResetExpires < new Date()) {
    return null;
  }
  return { email: user.email, gymName: user.tenant?.name ?? "GymRebel" };
}

export type ResetResult = { ok: true } | { ok: false; error: string };

/**
 * Voltooi de reset: valideer token + wachtwoordbeleid, zet het nieuwe wachtwoord,
 * null de token, en invalideer alle bestaande sessies. Stuurt best-effort een
 * "wachtwoord gewijzigd"-beveiligingsmelding.
 */
export async function completePasswordReset(
  token: string,
  newPassword: string,
  origin: string
): Promise<ResetResult> {
  if (!token) return { ok: false, error: "Deze link is ongeldig of verlopen." };
  if (!passwordMeetsPolicy(newPassword)) {
    return {
      ok: false,
      error: `Wachtwoord voldoet niet aan de eisen (min. ${MIN_PASSWORD_LENGTH} tekens, hoofd- en kleine letter, cijfer én speciaal teken).`,
    };
  }

  const user = await prisma.user.findUnique({
    where: { passwordResetToken: token },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      tenantId: true,
      locale: true,
      passwordResetExpires: true,
      notificationPrefs: true,
    },
  });
  if (!user || !user.passwordResetExpires || user.passwordResetExpires < new Date()) {
    return {
      ok: false,
      error: "Deze link is ongeldig of verlopen. Vraag een nieuwe reset-link aan.",
    };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(newPassword),
      passwordResetToken: null,
      passwordResetExpires: null,
      // Logout overal: sessies vóór nu ongeldig + device-sessies intrekken.
      sessionsValidFrom: new Date(),
    },
  });
  await prisma.userSession.updateMany({
    where: { userId: user.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  await audit("auth.password.reset.complete", {
    actor: { id: user.id, email: user.email, role: user.role },
    tenantId: user.tenantId ?? null,
    targetType: "User",
    targetId: user.id,
  });

  // Beveiligingsmelding (best-effort — breekt de reset niet). Respecteert de
  // meldingsvoorkeur (categorie: beveiliging); standaard staat e-mail aan.
  if (prefAllows(user.notificationPrefs, "security", "email")) {
    try {
      const branding = await loadTenantBranding(user.tenantId);
      await sendEmail({
        to: user.email,
        message: await passwordChangedMessage({
          branding,
          recipientName: user.name,
          securityUrl: `${origin}/account/beveiliging`,
          locale: user.locale,
        }),
      });
    } catch (err) {
      console.error("✗ Wachtwoord-reset-bevestiging mislukt:", (err as Error).message);
    }
  }

  if (prefAllows(user.notificationPrefs, "security", "inApp")) {
    await createInAppNotification({
      userId: user.id,
      tenantId: user.tenantId,
      category: "security",
      title: "Wachtwoord opnieuw ingesteld",
      body: "Je wachtwoord is zojuist via een reset-link aangepast. Was jij dit niet? Beveilig direct je account.",
      link: "/account/beveiliging",
    });
  }

  return { ok: true };
}
