"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSuperadmin } from "@/lib/superadmin";
import { audit } from "@/lib/audit";
import { inviteToken, inviteExpiry, sendInviteEmail } from "@/lib/invitation";

const tenantRole = z.enum(["TENANT_ADMIN", "TENANT_MEMBER"]);

async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

function revalidate(tenantId: string) {
  revalidatePath(`/admin/tenants/${tenantId}`);
}

const inviteSchema = z.object({
  tenantId: z.string().min(1),
  email: z.string().trim().email(),
  role: tenantRole,
});

export async function inviteToTenant(formData: FormData) {
  const admin = await requireSuperadmin();
  const parsed = inviteSchema.safeParse({
    tenantId: formData.get("tenantId"),
    email: formData.get("email"),
    role: formData.get("role"),
  });
  if (!parsed.success) return;
  const { tenantId, email, role } = parsed.data;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true, slug: true },
  });
  if (!tenant) return;

  // Al lid van deze tenant? Dan niet uitnodigen.
  const existingUser = await prisma.user.findUnique({
    where: { tenantId_email: { tenantId, email } },
    select: { id: true },
  });
  if (existingUser) return;

  const token = inviteToken();
  await prisma.invitation.upsert({
    where: { tenantId_email: { tenantId, email } },
    update: { role, token, expiresAt: inviteExpiry(), invitedById: admin.id, acceptedAt: null },
    create: { tenantId, email, role, token, expiresAt: inviteExpiry(), invitedById: admin.id },
  });

  await sendInviteEmail({
    email,
    tenantName: tenant.name,
    acceptUrl: `${await origin()}/invite/${token}`,
  });
  await audit("user.invite", { actor: admin, tenantId, targetType: "Invitation", metadata: { email, role } });

  revalidate(tenantId);
}

export async function revokeInvitation(formData: FormData) {
  const admin = await requireSuperadmin();
  const id = String(formData.get("invitationId") ?? "");
  const tenantId = String(formData.get("tenantId") ?? "");
  if (!id || !tenantId) return;

  await prisma.invitation.deleteMany({ where: { id, tenantId } });
  await audit("user.invite.revoke", { actor: admin, tenantId, targetType: "Invitation", targetId: id });
  revalidate(tenantId);
}

const roleChangeSchema = z.object({
  tenantId: z.string().min(1),
  userId: z.string().min(1),
  role: tenantRole,
});

export async function setMemberRole(formData: FormData) {
  const admin = await requireSuperadmin();
  const parsed = roleChangeSchema.safeParse({
    tenantId: formData.get("tenantId"),
    userId: formData.get("userId"),
    role: formData.get("role"),
  });
  if (!parsed.success) return;
  const { tenantId, userId, role } = parsed.data;

  const res = await prisma.user.updateMany({ where: { id: userId, tenantId }, data: { role } });
  if (res.count > 0) {
    await audit("user.role.change", { actor: admin, tenantId, targetType: "User", targetId: userId, metadata: { role } });
  }
  revalidate(tenantId);
}

export async function setMemberActive(formData: FormData) {
  const admin = await requireSuperadmin();
  const tenantId = String(formData.get("tenantId") ?? "");
  const userId = String(formData.get("userId") ?? "");
  const active = formData.get("active") === "true";
  if (!tenantId || !userId) return;

  const res = await prisma.user.updateMany({ where: { id: userId, tenantId }, data: { active } });
  if (res.count > 0) {
    await audit(active ? "user.activate" : "user.deactivate", { actor: admin, tenantId, targetType: "User", targetId: userId });
  }
  revalidate(tenantId);
}

export async function deleteMember(formData: FormData) {
  const admin = await requireSuperadmin();
  const tenantId = String(formData.get("tenantId") ?? "");
  const userId = String(formData.get("userId") ?? "");
  if (!tenantId || !userId) return;

  const res = await prisma.user.deleteMany({ where: { id: userId, tenantId } });
  if (res.count > 0) {
    await audit("user.delete", { actor: admin, tenantId, targetType: "User", targetId: userId });
  }
  revalidate(tenantId);
}
