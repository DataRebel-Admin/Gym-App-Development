"use server";

import { z } from "zod";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/db";
import { signIn } from "@/auth";
import { audit } from "@/lib/audit";
import { hashPassword } from "@/lib/security";
import { passwordMeetsPolicy } from "@/lib/password-policy";
import { mintLoginChallenge } from "@/lib/login-challenge";
import { AUTH_TENANT_COOKIE } from "@/lib/constants";
import { createInvitation } from "@/lib/invitation";
import { loadTenantBranding } from "@/lib/email/branding";
import { welcomeMessage } from "@/lib/email/messages";
import { sendEmail } from "@/lib/email/send";

async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Herlaad een uitnodiging + tenant en bepaal of 'ie nog bruikbaar is. Gedeeld
 *  door de activatiepagina en de server-action zodat de poort op één plek zit. */
async function loadUsableInvite(token: string) {
  const invite = await prisma.invitation.findUnique({
    where: { token },
    include: { tenant: { select: { id: true, slug: true, status: true, deletedAt: true } } },
  });
  if (!invite || !invite.tenant || invite.tenant.deletedAt || invite.tenant.status !== "ACTIVE") {
    return { invite: null as null, reason: "invalid" as const };
  }
  if (invite.acceptedAt) return { invite, reason: "accepted" as const };
  if (invite.expiresAt < new Date()) return { invite, reason: "expired" as const };
  return { invite, reason: "ok" as const };
}

export type ActivationState = { error?: string; requirement?: string };

const activationSchema = z
  .object({
    token: z.string().min(1),
    password: z.string().min(1, "Wachtwoord vereist"),
    confirm: z.string().min(1, "Bevestig je wachtwoord"),
  })
  .refine((v) => v.password === v.confirm, {
    message: "De wachtwoorden komen niet overeen",
    path: ["confirm"],
  });

/**
 * Activeer een account via de uitnodigingslink: verplicht een wachtwoord instellen.
 * De link is eenmalig (acceptedAt) en tijdgebonden (expiresAt) — beide worden hier
 * hergecontroleerd, zodat een verlopen of al gebruikte link nooit een account activeert.
 * Bij succes wordt de gebruiker meteen ingelogd en doorgestuurd naar het dashboard.
 */
export async function activateAccount(
  _prev: ActivationState,
  formData: FormData
): Promise<ActivationState> {
  const parsed = activationSchema.safeParse({
    token: formData.get("token") ?? "",
    password: formData.get("password") ?? "",
    confirm: formData.get("confirm") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ongeldige invoer" };
  }
  const { token, password } = parsed.data;

  // Server-side afdwingen — nooit alleen op de client-checklist vertrouwen.
  if (!passwordMeetsPolicy(password)) {
    return { error: "Wachtwoord voldoet niet aan de eisen." };
  }

  const { invite, reason } = await loadUsableInvite(token);
  if (reason === "invalid" || !invite) redirect(`/invite/${token}`);
  if (reason !== "ok") redirect(`/invite/${token}`);

  const passwordHash = await hashPassword(password);

  // Bestaande gebruiker binnen deze tenant? Heractiveer + zet wachtwoord; anders aanmaken.
  const existing = await prisma.user.findUnique({
    where: { tenantId_email: { tenantId: invite.tenantId, email: invite.email } },
    select: { id: true, name: true },
  });

  let recipientName: string | null = existing?.name ?? null;
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { active: true, passwordHash, emailVerified: new Date() },
    });
  } else {
    const created = await prisma.user.create({
      data: {
        tenantId: invite.tenantId,
        email: invite.email,
        role: invite.role,
        active: true,
        passwordHash,
        emailVerified: new Date(),
      },
      select: { name: true },
    });
    recipientName = created.name;
  }

  // Eenmalig: markeer geaccepteerd zodat dezelfde link niet nogmaals werkt.
  await prisma.invitation.update({
    where: { id: invite.id },
    data: { acceptedAt: new Date() },
  });

  const auditActor = { email: invite.email, role: invite.role };
  await audit("user.password.set", {
    actor: auditActor, tenantId: invite.tenantId, targetType: "User", metadata: { email: invite.email },
  });
  await audit("user.activate", {
    actor: auditActor, tenantId: invite.tenantId, targetType: "User", metadata: { email: invite.email },
  });
  await audit("user.invite.accept", {
    actor: auditActor, tenantId: invite.tenantId, targetType: "User", metadata: { email: invite.email },
  });

  // Welkomstmail met de huisstijl van de tenant (best-effort — breekt de flow niet).
  try {
    const branding = await loadTenantBranding(invite.tenantId);
    const loginUrl = `${await origin()}/login?tenant=${invite.tenant.slug}`;
    await sendEmail({
      to: invite.email,
      message: await welcomeMessage({ branding, recipientName, loginUrl }),
      devLink: loginUrl,
    });
  } catch (err) {
    console.error("✗ Welkomstmail mislukt:", (err as Error).message);
  }

  // Auto-login: zet de tenant-cookie (zodat de tenant-scoped resolutie het account
  // vindt) en mint een challenge die bewijst dat het wachtwoord zojuist is geverifieerd.
  (await cookies()).set(AUTH_TENANT_COOKIE, invite.tenant.slug, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 15,
  });
  const challenge = mintLoginChallenge({ email: invite.email, tenantId: invite.tenantId });
  try {
    await signIn("credentials", { email: invite.email, challenge, redirectTo: "/" });
  } catch (e) {
    if (e instanceof AuthError) {
      // Account is wél aangemaakt/geactiveerd — stuur de gebruiker naar de login.
      redirect(`/login?tenant=${invite.tenant.slug}`);
    }
    throw e; // NEXT_REDIRECT bij succes
  }
  return {};
}

/**
 * Vraag een nieuwe activatielink aan voor een verlopen uitnodiging. Werkt alleen
 * met een echte (verlopen, nog niet geaccepteerde) token; de nieuwe mail gaat naar
 * het uitgenodigde adres — niet naar wie de knop indrukt. Zo blijft de flow veilig
 * zonder dat de bezoeker ingelogd hoeft te zijn.
 */
export async function requestNewActivationLink(
  _prev: ActivationState,
  formData: FormData
): Promise<ActivationState> {
  const token = String(formData.get("token") ?? "");
  if (!token) return { error: "Ongeldige aanvraag." };

  const { invite, reason } = await loadUsableInvite(token);
  // Alleen verstuurbaar voor een bestaande, verlopen (niet-geaccepteerde) uitnodiging.
  if (!invite || reason === "accepted") {
    return { error: "Deze link kan niet vernieuwd worden. Vraag de sportschool om een nieuwe uitnodiging." };
  }

  await createInvitation({
    tenantId: invite.tenantId,
    email: invite.email,
    role: invite.role,
    invitedById: invite.invitedById,
    origin: await origin(),
  });
  await audit("user.activate.resend", {
    actor: { email: invite.email, role: invite.role },
    tenantId: invite.tenantId,
    targetType: "Invitation",
    metadata: { email: invite.email },
  });

  redirect(`/invite/${token}?resent=1`);
}
