"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";

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
    select: { id: true },
  });

  if (existing) {
    await prisma.user.update({ where: { id: existing.id }, data: { active: true } });
  } else {
    await prisma.user.create({
      data: {
        tenantId: invite.tenantId,
        email: invite.email,
        role: invite.role,
        active: true,
      },
    });
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

  redirect(`/login?tenant=${invite.tenant.slug}`);
}
