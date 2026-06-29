"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOwner } from "@/lib/owner";
import { audit } from "@/lib/audit";
import { inviteToken, inviteExpiry, sendInviteEmail } from "@/lib/invitation";

const tenantRole = z.enum(["TENANT_ADMIN", "TENANT_MEMBER"]);

async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

const inviteSchema = z.object({ email: z.string().trim().email(), role: tenantRole });

export async function inviteMember(formData: FormData) {
  const owner = await requireOwner();
  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
  });
  if (!parsed.success) return;
  const { email, role } = parsed.data;

  const existing = await prisma.user.findUnique({
    where: { tenantId_email: { tenantId: owner.tenantId, email } },
    select: { id: true },
  });
  if (existing) return;

  const tenant = await prisma.tenant.findUnique({
    where: { id: owner.tenantId },
    select: { name: true },
  });

  const token = inviteToken();
  await prisma.invitation.upsert({
    where: { tenantId_email: { tenantId: owner.tenantId, email } },
    update: { role, token, expiresAt: inviteExpiry(), invitedById: owner.id, acceptedAt: null },
    create: { tenantId: owner.tenantId, email, role, token, expiresAt: inviteExpiry(), invitedById: owner.id },
  });

  await sendInviteEmail({
    email,
    tenantName: tenant?.name ?? "GymRebel",
    acceptUrl: `${await origin()}/invite/${token}`,
  });
  await audit("user.invite", { actor: owner, tenantId: owner.tenantId, targetType: "Invitation", metadata: { email, role } });

  revalidatePath("/owner/members");
}

export async function revokeMemberInvite(formData: FormData) {
  const owner = await requireOwner();
  const id = String(formData.get("invitationId") ?? "");
  if (!id) return;
  await prisma.invitation.deleteMany({ where: { id, tenantId: owner.tenantId } });
  await audit("user.invite.revoke", { actor: owner, tenantId: owner.tenantId, targetType: "Invitation", targetId: id });
  revalidatePath("/owner/members");
}

export async function setMemberRole(formData: FormData) {
  const owner = await requireOwner();
  const parsed = z
    .object({ userId: z.string().min(1), role: tenantRole })
    .safeParse({ userId: formData.get("userId"), role: formData.get("role") });
  if (!parsed.success) return;
  const { userId, role } = parsed.data;

  const res = await prisma.user.updateMany({
    where: { id: userId, tenantId: owner.tenantId },
    data: { role },
  });
  if (res.count > 0) {
    await audit("user.role.change", { actor: owner, tenantId: owner.tenantId, targetType: "User", targetId: userId, metadata: { role } });
  }
  revalidatePath("/owner/members");
}

export async function setMemberActive(formData: FormData) {
  const owner = await requireOwner();
  const userId = String(formData.get("userId") ?? "");
  const active = formData.get("active") === "true";
  if (!userId) return;
  // Voorkom dat een admin zichzelf buitensluit.
  if (userId === owner.id) return;

  const res = await prisma.user.updateMany({
    where: { id: userId, tenantId: owner.tenantId },
    data: { active },
  });
  if (res.count > 0) {
    await audit(active ? "user.activate" : "user.deactivate", { actor: owner, tenantId: owner.tenantId, targetType: "User", targetId: userId });
  }
  revalidatePath("/owner/members");
}

export async function deleteMember(formData: FormData) {
  const owner = await requireOwner();
  const userId = String(formData.get("userId") ?? "");
  if (!userId || userId === owner.id) return; // niet jezelf verwijderen

  const res = await prisma.user.deleteMany({ where: { id: userId, tenantId: owner.tenantId } });
  if (res.count > 0) {
    await audit("user.delete", { actor: owner, tenantId: owner.tenantId, targetType: "User", targetId: userId });
  }
  revalidatePath("/owner/members");
}
