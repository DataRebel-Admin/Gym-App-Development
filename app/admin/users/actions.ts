"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSuperadmin } from "@/lib/superadmin";
import { audit } from "@/lib/audit";
import { createInvitation } from "@/lib/invitation";
import { releaseMemberClassSpots } from "@/lib/class-enrollment";
import type { EmailDelivery } from "@/lib/email/send";
import { TENANT_ROLES } from "./role-meta";

const tenantRole = z.enum(["TENANT_ADMIN", "TENANT_MEMBER"]);

async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3001";
  const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export type InviteFormState = {
  ok?: boolean;
  error?: string;
  /** `"logged"` = de uitnodiging staat klaar, maar er ging géén mail de deur uit. */
  delivery?: EmailDelivery;
};

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

  const delivery = await createInvitation({
    tenantId,
    email,
    role,
    invitedById: admin.id,
    origin: await origin(),
    actor: admin,
  });
  await audit("user.invite", { actor: admin, tenantId, targetType: "Invitation", metadata: { email, role, delivery } });

  revalidatePath("/admin/users");
  return { ok: true, delivery };
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

  const delivery = await createInvitation({
    tenantId: inv.tenantId,
    email: inv.email,
    role: inv.role,
    invitedById: admin.id,
    origin: await origin(),
    actor: admin,
  });
  await audit("user.invite.resend", { actor: admin, tenantId: inv.tenantId, targetType: "Invitation", targetId: id, metadata: { email: inv.email, delivery } });

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

// ---------------------------------------------------------------------------
// Gebruiker bewerken (detailpagina /admin/users/[id])
// ---------------------------------------------------------------------------

export type UserEditState = { error?: string; ok?: boolean };

const editSchema = z.object({
  userId: z.string().min(1),
  email: z.string().trim().email("Ongeldig e-mailadres"),
  name: z.string().trim().max(120).optional().or(z.literal("")),
  role: z.enum(TENANT_ROLES).optional(),
});

function revalidateUser(userId: string, tenantId: string | null) {
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
  if (tenantId) revalidatePath(`/admin/tenants/${tenantId}`);
}

/**
 * Naam, e-mailadres en (voor tenant-gebruikers) rol wijzigen. Een superadmin
 * heeft geen tenant en dus geen tenant-rol; die kan hier alleen naam/e-mail
 * kwijt. De eigen rol is nooit wijzigbaar (zelf-degradatie sluit je buiten).
 */
export async function updateUser(
  _prev: UserEditState,
  formData: FormData
): Promise<UserEditState> {
  const admin = await requireSuperadmin();
  const parsed = editSchema.safeParse({
    userId: formData.get("userId"),
    email: formData.get("email"),
    name: formData.get("name") || "",
    role: formData.get("role") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ongeldige invoer" };
  const { userId, name } = parsed.data;
  const email = parsed.data.email.toLowerCase();

  const current = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, role: true, tenantId: true },
  });
  if (!current) return { error: "Gebruiker niet gevonden" };

  // Rol: alleen tenant-gebruikers hebben een tenant-rol; jezelf blijft wat je bent.
  const nextRole =
    current.tenantId && userId !== admin.id && parsed.data.role ? parsed.data.role : current.role;

  const emailChanged = email !== current.email.toLowerCase();
  if (emailChanged) {
    // Uniek binnen de tenant; voor superadmins (tenantId null) globaal uniek.
    const clash = await prisma.user.findFirst({
      where: { tenantId: current.tenantId, email, id: { not: userId } },
      select: { id: true },
    });
    if (clash) {
      return {
        error: current.tenantId
          ? "Dit e-mailadres is al in gebruik in deze tenant"
          : "Dit e-mailadres is al in gebruik",
      };
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      name: name || null,
      email,
      role: nextRole,
      // Een openstaand zelf-service-wijzigingsverzoek naar het oude adres vervalt.
      ...(emailChanged ? { pendingEmail: null, emailChangeToken: null, emailChangeExpires: null } : {}),
    },
  });

  const base = { actor: admin, tenantId: current.tenantId, targetType: "User", targetId: userId } as const;
  await audit("user.update", { ...base, metadata: { name: name || email, role: nextRole } });
  if (nextRole !== current.role) {
    await audit("user.role.change", {
      ...base,
      oldValue: { role: current.role },
      newValue: { role: nextRole },
      metadata: { role: nextRole },
    });
  }
  if (emailChanged) {
    await audit("user.email.change", {
      ...base,
      oldValue: { email: current.email },
      newValue: { email },
      metadata: { newEmail: email },
    });
  }

  revalidateUser(userId, current.tenantId);
  return { ok: true };
}

/** Account (de)activeren. Een gedeactiveerd account kan niet meer inloggen. */
export async function setUserActive(formData: FormData) {
  const admin = await requireSuperadmin();
  const userId = String(formData.get("userId") ?? "");
  const active = formData.get("active") === "true";
  if (!userId || userId === admin.id) return;

  const current = await prisma.user.findUnique({ where: { id: userId }, select: { tenantId: true, active: true } });
  if (!current || current.active === active) return;

  await prisma.user.update({ where: { id: userId }, data: { active } });
  await audit(active ? "user.activate" : "user.deactivate", {
    actor: admin, tenantId: current.tenantId, targetType: "User", targetId: userId,
  });
  // Gedeactiveerd lid: toekomstige lesplekken vrijgeven (wachtlijst schuift door).
  if (!active && current.tenantId) await releaseMemberClassSpots(current.tenantId, userId, admin);

  revalidateUser(userId, current.tenantId);
}

/** Tweestapsverificatie uitschakelen (support: gebruiker is de authenticator kwijt). */
export async function resetUserTwoFactor(formData: FormData) {
  const admin = await requireSuperadmin();
  const userId = String(formData.get("userId") ?? "");
  if (!userId) return;

  const current = await prisma.user.findUnique({ where: { id: userId }, select: { tenantId: true, twoFactorEnabled: true } });
  if (!current) return;

  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorEnabled: false, twoFactorSecret: null },
  });
  await audit("user.2fa.reset", {
    actor: admin, tenantId: current.tenantId, targetType: "User", targetId: userId,
    metadata: { wasEnabled: current.twoFactorEnabled },
  });
  revalidateUser(userId, current.tenantId);
}

/** Alle sessies van de gebruiker beëindigen (JWT's vóór nu ongeldig + device-sessies ingetrokken). */
export async function revokeUserSessions(formData: FormData) {
  const admin = await requireSuperadmin();
  const userId = String(formData.get("userId") ?? "");
  if (!userId) return;

  const current = await prisma.user.findUnique({ where: { id: userId }, select: { tenantId: true } });
  if (!current) return;

  const now = new Date();
  await prisma.user.update({ where: { id: userId }, data: { sessionsValidFrom: now } });
  const revoked = await prisma.userSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: now },
  });
  await audit("user.sessions.revoke", {
    actor: admin, tenantId: current.tenantId, targetType: "User", targetId: userId,
    metadata: { revoked: revoked.count },
  });
  revalidateUser(userId, current.tenantId);
}

/** Gebruiker definitief verwijderen. Nooit jezelf. */
export async function deleteUser(formData: FormData) {
  const admin = await requireSuperadmin();
  const userId = String(formData.get("userId") ?? "");
  if (!userId || userId === admin.id) return;

  const current = await prisma.user.findUnique({ where: { id: userId }, select: { tenantId: true, email: true } });
  if (!current) return;

  // Vóór de delete: de cascade wist aanmeldingen zonder wachtlijst-doorschuiving.
  if (current.tenantId) await releaseMemberClassSpots(current.tenantId, userId, admin);
  await prisma.user.delete({ where: { id: userId } });
  await audit("user.delete", {
    actor: admin, tenantId: current.tenantId, targetType: "User", targetId: userId,
    metadata: { email: current.email },
  });

  revalidatePath("/admin/users");
  if (current.tenantId) revalidatePath(`/admin/tenants/${current.tenantId}`);
  redirect("/admin/users?deleted=1");
}
