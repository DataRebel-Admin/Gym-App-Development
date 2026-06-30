"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { loadTenantBranding } from "@/lib/email/branding";
import { welcomeMessage } from "@/lib/email/messages";
import { sendEmail } from "@/lib/email/send";

async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Accepteer een uitnodiging: maak (indien nodig) de gebruiker aan en stuur door
 *  naar de tenant-login. */
export async function acceptInvitation(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  if (!token) redirect("/login");

  const invite = await prisma.invitation.findUnique({
    where: { token },
    include: { tenant: { select: { slug: true, status: true, deletedAt: true } } },
  });

  if (
    !invite ||
    invite.acceptedAt ||
    invite.expiresAt < new Date() ||
    !invite.tenant ||
    invite.tenant.deletedAt ||
    invite.tenant.status !== "ACTIVE"
  ) {
    redirect("/invite/invalid");
  }

  // Bestaande gebruiker binnen deze tenant? Heractiveer; anders aanmaken.
  const existing = await prisma.user.findUnique({
    where: { tenantId_email: { tenantId: invite.tenantId, email: invite.email } },
    select: { id: true, name: true },
  });

  let recipientName: string | null = existing?.name ?? null;
  if (existing) {
    await prisma.user.update({ where: { id: existing.id }, data: { active: true } });
  } else {
    const created = await prisma.user.create({
      data: {
        tenantId: invite.tenantId,
        email: invite.email,
        role: invite.role,
        active: true,
      },
      select: { name: true },
    });
    recipientName = created.name;
  }

  await prisma.invitation.update({
    where: { id: invite.id },
    data: { acceptedAt: new Date() },
  });

  await audit("user.invite.accept", {
    actor: { email: invite.email, role: invite.role },
    tenantId: invite.tenantId,
    targetType: "User",
    metadata: { email: invite.email },
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

  redirect(`/login?tenant=${invite.tenant.slug}`);
}
