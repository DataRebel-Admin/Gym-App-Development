"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOwner } from "@/lib/owner";
import { requirePermission } from "@/lib/staff";
import { audit } from "@/lib/audit";
import { createInvitation } from "@/lib/invitation";
import { notifyInApp } from "@/lib/notifications";

const tenantRole = z.enum(["TENANT_ADMIN", "TENANT_STAFF", "TENANT_MEMBER"]);

async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3001";
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

  await createInvitation({ tenantId: owner.tenantId, email, role, invitedById: owner.id, origin: await origin() });
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

/** (Her)verstuur een uitstaande uitnodiging op basis van haar id (gescoped op tenant). */
export async function resendMemberInviteById(formData: FormData) {
  const owner = await requireOwner();
  const id = String(formData.get("invitationId") ?? "");
  if (!id) return;

  const inv = await prisma.invitation.findFirst({
    where: { id, tenantId: owner.tenantId },
    select: { email: true, role: true },
  });
  if (!inv) return;

  await createInvitation({ tenantId: owner.tenantId, email: inv.email, role: inv.role, invitedById: owner.id, origin: await origin() });
  await audit("user.invite.resend", { actor: owner, tenantId: owner.tenantId, targetType: "Invitation", targetId: id, metadata: { email: inv.email } });

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

const addSchema = z.object({
  email: z.string().trim().email(),
  name: z.string().trim().max(120).optional().or(z.literal("")),
  role: tenantRole,
});

export type MemberFormState = { error?: string };

/** Lid handmatig toevoegen (zonder uitnodiging). */
export async function addMember(
  _prev: MemberFormState,
  formData: FormData
): Promise<MemberFormState> {
  const owner = await requireOwner();
  const parsed = addSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name") || "",
    role: formData.get("role"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ongeldige invoer" };
  const { email, name, role } = parsed.data;

  const existing = await prisma.user.findUnique({
    where: { tenantId_email: { tenantId: owner.tenantId, email } },
    select: { id: true },
  });
  if (existing) return { error: "Dit e-mailadres bestaat al in deze sportschool" };

  const user = await prisma.user.create({
    data: { tenantId: owner.tenantId, email, name: name || null, role, active: true },
  });
  await audit("user.create", { actor: owner, tenantId: owner.tenantId, targetType: "User", targetId: user.id, metadata: { email, role } });

  revalidatePath("/owner/members");
  return {};
}

const editSchema = z.object({
  userId: z.string().min(1),
  name: z.string().trim().max(120).optional().or(z.literal("")),
  role: tenantRole,
});

export async function editMember(
  _prev: MemberFormState,
  formData: FormData
): Promise<MemberFormState> {
  const owner = await requireOwner();
  const parsed = editSchema.safeParse({
    userId: formData.get("userId"),
    name: formData.get("name") || "",
    role: formData.get("role"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ongeldige invoer" };
  const { userId, name, role } = parsed.data;

  const res = await prisma.user.updateMany({
    where: { id: userId, tenantId: owner.tenantId },
    data: { name: name || null, role },
  });
  if (res.count === 0) return { error: "Lid niet gevonden" };
  await audit("user.update", { actor: owner, tenantId: owner.tenantId, targetType: "User", targetId: userId, metadata: { name, role } });

  revalidatePath("/owner/members");
  revalidatePath(`/owner/members/${userId}`);
  return {};
}

async function setArchived(userId: string, archived: boolean) {
  const owner = await requireOwner();
  if (!userId || userId === owner.id) return;
  const res = await prisma.user.updateMany({
    where: { id: userId, tenantId: owner.tenantId },
    data: { archivedAt: archived ? new Date() : null },
  });
  if (res.count > 0) {
    await audit(archived ? "user.archive" : "user.unarchive", { actor: owner, tenantId: owner.tenantId, targetType: "User", targetId: userId });
  }
  revalidatePath("/owner/members");
}

export async function archiveMember(formData: FormData) {
  await setArchived(String(formData.get("userId") ?? ""), true);
}

export async function unarchiveMember(formData: FormData) {
  await setArchived(String(formData.get("userId") ?? ""), false);
}

/** Koppel een coach (medewerker/eigenaar) aan een lid en informeer de coach. */
export async function assignCoach(formData: FormData) {
  const owner = await requireOwner();
  const parsed = z
    .object({ memberId: z.string().min(1), coachId: z.string().min(1) })
    .safeParse({ memberId: formData.get("memberId"), coachId: formData.get("coachId") });
  if (!parsed.success) return;
  const { memberId, coachId } = parsed.data;

  const [member, coach] = await Promise.all([
    prisma.user.findFirst({
      where: { id: memberId, tenantId: owner.tenantId, role: "TENANT_MEMBER" },
      select: { id: true, name: true, email: true },
    }),
    prisma.user.findFirst({
      where: { id: coachId, tenantId: owner.tenantId, role: { in: ["TENANT_ADMIN", "TENANT_STAFF"] } },
      select: { id: true },
    }),
  ]);
  if (!member || !coach) return;

  // Idempotent: dubbele koppeling bestaat niet (unieke index).
  const existing = await prisma.coachAssignment.findUnique({
    where: { tenantId_coachId_memberId: { tenantId: owner.tenantId, coachId, memberId } },
    select: { id: true },
  });
  if (!existing) {
    await prisma.coachAssignment.create({
      data: { tenantId: owner.tenantId, coachId, memberId, assignedById: owner.id },
    });
    await audit("coach.assign", {
      actor: owner, tenantId: owner.tenantId, targetType: "User", targetId: memberId,
      metadata: { coachId, member: member.name ?? member.email },
    });
    // "Lid toegewezen" — informeer de coach (respecteert meldingsvoorkeuren).
    await notifyInApp({
      userId: coachId,
      tenantId: owner.tenantId,
      category: "new_members",
      title: "Nieuw lid toegewezen",
      body: `${member.name ?? member.email} is aan jou toegewezen als coach.`,
      link: `/owner/members/${memberId}`,
    });
  }

  revalidatePath(`/owner/members/${memberId}`);
}

/** Verwijder een coach-koppeling van een lid. */
export async function unassignCoach(formData: FormData) {
  const owner = await requireOwner();
  const memberId = String(formData.get("memberId") ?? "");
  const coachId = String(formData.get("coachId") ?? "");
  if (!memberId || !coachId) return;

  const res = await prisma.coachAssignment.deleteMany({
    where: { tenantId: owner.tenantId, memberId, coachId },
  });
  if (res.count > 0) {
    await audit("coach.unassign", {
      actor: owner, tenantId: owner.tenantId, targetType: "User", targetId: memberId,
      metadata: { coachId },
    });
  }
  revalidatePath(`/owner/members/${memberId}`);
}

/**
 * Een medewerker koppelt zichzelf als coach aan een lid. Vereist dat de eigenaar
 * de permissie `members:assign-self` heeft aangezet voor deze medewerker. De
 * coach kan uitsluitend zichzelf koppelen (coachId wordt geforceerd op me.id).
 */
export async function selfAssignCoach(formData: FormData) {
  const me = await requirePermission("members:assign-self");
  const memberId = String(formData.get("memberId") ?? "");
  if (!memberId) return;

  const member = await prisma.user.findFirst({
    where: { id: memberId, tenantId: me.tenantId, role: "TENANT_MEMBER" },
    select: { id: true },
  });
  if (!member) return;

  const existing = await prisma.coachAssignment.findUnique({
    where: { tenantId_coachId_memberId: { tenantId: me.tenantId, coachId: me.id, memberId } },
    select: { id: true },
  });
  if (!existing) {
    await prisma.coachAssignment.create({
      data: { tenantId: me.tenantId, coachId: me.id, memberId, assignedById: me.id },
    });
    await audit("coach.assign", {
      actor: me, tenantId: me.tenantId, targetType: "User", targetId: memberId,
      metadata: { coachId: me.id, self: true },
    });
  }
  revalidatePath(`/owner/members/${memberId}`);
}

/** Een medewerker koppelt zichzelf los als coach van een lid. */
export async function selfUnassignCoach(formData: FormData) {
  const me = await requirePermission("members:assign-self");
  const memberId = String(formData.get("memberId") ?? "");
  if (!memberId) return;

  const res = await prisma.coachAssignment.deleteMany({
    where: { tenantId: me.tenantId, memberId, coachId: me.id },
  });
  if (res.count > 0) {
    await audit("coach.unassign", {
      actor: me, tenantId: me.tenantId, targetType: "User", targetId: memberId,
      metadata: { coachId: me.id, self: true },
    });
  }
  revalidatePath(`/owner/members/${memberId}`);
}

/** (Her)verstuur een uitnodiging — werkt ook voor 'niet uitgenodigd' en 'verlopen'. */
export async function resendInvite(formData: FormData) {
  const owner = await requireOwner();
  const userId = String(formData.get("userId") ?? "");
  if (!userId) return;

  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId: owner.tenantId },
    select: { email: true, role: true },
  });
  if (!user) return;

  await createInvitation({ tenantId: owner.tenantId, email: user.email, role: user.role, invitedById: owner.id, origin: await origin() });
  await audit("user.invite.resend", { actor: owner, tenantId: owner.tenantId, targetType: "Invitation", metadata: { email: user.email } });

  revalidatePath("/owner/members");
}
