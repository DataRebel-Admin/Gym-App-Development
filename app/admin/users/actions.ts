"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSuperadmin } from "@/lib/superadmin";
import { audit } from "@/lib/audit";
import { createInvitation } from "@/lib/invitation";

const tenantRole = z.enum(["TENANT_ADMIN", "TENANT_MEMBER"]);

async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3001";
  const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export type InviteFormState = { ok?: boolean; error?: string };

const inviteSchema = z.object({
  tenantId: z.string().min(1, "Kies een tenant"),
  email: z.string().trim().email("Ongeldig e-mailadres"),
  role: tenantRole,
});

/** Superadmin nodigt een gebruiker uit in een willekeurige tenant. */
export async function inviteUser(
  _prev: InviteFormState,
  formData: FormData
): Promise<InviteFormState> {
  const admin = await requireSuperadmin();
  const parsed = inviteSchema.safeParse({
    tenantId: formData.get("tenantId"),
    email: formData.get("email"),
    role: formData.get("role"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ongeldige invoer" };
  const { tenantId, email, role } = parsed.data;

  const tenant = await prisma.tenant.findFirst({
    where: { id: tenantId, deletedAt: null },
    select: { id: true },
  });
  if (!tenant) return { error: "Tenant niet gevonden" };

  const existingUser = await prisma.user.findUnique({
    where: { tenantId_email: { tenantId, email } },
    select: { emailVerified: true },
  });
  if (existingUser?.emailVerified) {
    return { error: "Deze gebruiker heeft al een actief account in deze tenant" };
  }

  await createInvitation({ tenantId, email, role, invitedById: admin.id, origin: await origin() });
  await audit("user.invite", { actor: admin, tenantId, targetType: "Invitation", metadata: { email, role } });

  revalidatePath("/admin/users");
  return { ok: true };
}

/** Verstuur een bestaande uitnodiging opnieuw (nieuwe token + vervaldatum). */
export async function resendInvitation(formData: FormData) {
  const admin = await requireSuperadmin();
  const id = String(formData.get("invitationId") ?? "");
  if (!id) return;

  const inv = await prisma.invitation.findUnique({
    where: { id },
    select: { tenantId: true, email: true, role: true },
  });
  if (!inv) return;

  await createInvitation({
    tenantId: inv.tenantId,
    email: inv.email,
    role: inv.role,
    invitedById: admin.id,
    origin: await origin(),
  });
  await audit("user.invite.resend", { actor: admin, tenantId: inv.tenantId, targetType: "Invitation", targetId: id, metadata: { email: inv.email } });

  revalidatePath("/admin/users");
}

export async function revokeInvitation(formData: FormData) {
  const admin = await requireSuperadmin();
  const id = String(formData.get("invitationId") ?? "");
  if (!id) return;

  const inv = await prisma.invitation.findUnique({ where: { id }, select: { tenantId: true, email: true } });
  if (!inv) return;

  await prisma.invitation.delete({ where: { id } });
  await audit("user.invite.revoke", { actor: admin, tenantId: inv.tenantId, targetType: "Invitation", targetId: id, metadata: { email: inv.email } });

  revalidatePath("/admin/users");
}
