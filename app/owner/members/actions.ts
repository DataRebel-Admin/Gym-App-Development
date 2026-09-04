"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOwner } from "@/lib/owner";
import { requirePermission } from "@/lib/staff";
import { resolveActiveLocationId } from "@/lib/location-resolve";
import { audit } from "@/lib/audit";
import { createInvitation } from "@/lib/invitation";
import { notifyInApp } from "@/lib/notifications";
import { releaseMemberClassSpots } from "@/lib/class-enrollment";

const tenantRole = z.enum(["TENANT_ADMIN", "TENANT_STAFF", "TENANT_MEMBER"]);

/**
 * Rollen die op **`/owner/staff`** thuishoren (het gym-team). `/owner/members` is
 * puur de sportersadministratie: daar wordt niets anders dan `TENANT_MEMBER`
 * aangemaakt. Zie `listMembers` (lib/members.ts).
 */
const TEAM_ROLES = ["TENANT_ADMIN", "TENANT_STAFF"] as const;

async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3001";
  const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

const inviteSchema = z.object({
  email: z.string().trim().email(),
  // Enige aanroeper is /owner/staff: hier worden alleen teamleden uitgenodigd.
  // Een lid komt via `addMember` in de ledenadministratie.
  role: z.enum(TEAM_ROLES),
});

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

  const delivery = await createInvitation({
    tenantId: owner.tenantId,
    email,
    role,
    invitedById: owner.id,
    origin: await origin(),
    actor: owner,
  });
  await audit("user.invite", { actor: owner, tenantId: owner.tenantId, targetType: "Invitation", metadata: { email, role, delivery } });

  revalidatePath("/owner/staff");
}

export async function revokeMemberInvite(formData: FormData) {
  const owner = await requireOwner();
  const id = String(formData.get("invitationId") ?? "");
  if (!id) return;
  await prisma.invitation.deleteMany({ where: { id, tenantId: owner.tenantId } });
  await audit("user.invite.revoke", { actor: owner, tenantId: owner.tenantId, targetType: "Invitation", targetId: id });
  // Beide lijsten tonen uitstaande uitnodigingen (leden resp. teamleden).
  revalidatePath("/owner/members");
  revalidatePath("/owner/staff");
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

  const delivery = await createInvitation({
    tenantId: owner.tenantId,
    email: inv.email,
    role: inv.role,
    invitedById: owner.id,
    origin: await origin(),
    actor: owner,
  });
  await audit("user.invite.resend", { actor: owner, tenantId: owner.tenantId, targetType: "Invitation", targetId: id, metadata: { email: inv.email, delivery } });

  revalidatePath("/owner/members");
  revalidatePath("/owner/staff");
}

/**
 * Rol wisselen binnen het team (`/owner/staff`). Kiest de eigenaar hier "Lid",
 * dan verhuist de persoon naar de ledenlijst — vandaar dat beide pagina's
 * gerevalideerd worden.
 */
export async function setMemberRole(formData: FormData) {
  const owner = await requireOwner();
  const parsed = z
    .object({ userId: z.string().min(1), role: tenantRole })
    .safeParse({ userId: formData.get("userId"), role: formData.get("role") });
  if (!parsed.success) return;
  const { userId, role } = parsed.data;
  // Een eigenaar mag zichzelf niet degraderen: dat sluit 'm uit z'n eigen
  // beheeromgeving (zelfde bescherming als setMemberActive/deleteMember).
  if (userId === owner.id) return;

  const res = await prisma.user.updateMany({
    where: { id: userId, tenantId: owner.tenantId },
    data: { role },
  });
  if (res.count > 0) {
    await audit("user.role.change", { actor: owner, tenantId: owner.tenantId, targetType: "User", targetId: userId, metadata: { role } });
  }
  revalidatePath("/owner/members");
  revalidatePath("/owner/staff");
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
    // Een gedeactiveerd lid komt niet meer; z'n toekomstige lesplekken gaan
    // naar de wachtlijst (heractiveren = opnieuw aanmelden).
    if (!active) await releaseMemberClassSpots(owner.tenantId, userId, owner);
  }
  // Gedeeld door de leden- en de medewerkerslijst.
  revalidatePath("/owner/members");
  revalidatePath("/owner/staff");
}

export async function deleteMember(formData: FormData) {
  const owner = await requireOwner();
  const userId = String(formData.get("userId") ?? "");
  if (!userId || userId === owner.id) return; // niet jezelf verwijderen

  // Vóór de delete: de cascade wist de aanmeldingen zonder dat de wachtlijst
  // doorschuift — plekken eerst netjes vrijgeven (no-op als er niets staat).
  await releaseMemberClassSpots(owner.tenantId, userId, owner);
  const res = await prisma.user.deleteMany({ where: { id: userId, tenantId: owner.tenantId } });
  if (res.count > 0) {
    await audit("user.delete", { actor: owner, tenantId: owner.tenantId, targetType: "User", targetId: userId });
  }
  revalidatePath("/owner/members");
  revalidatePath("/owner/staff");
}

const addSchema = z.object({
  email: z.string().trim().email(),
  name: z.string().trim().max(120).optional().or(z.literal("")),
  memberNumber: z.string().trim().max(60).optional().or(z.literal("")),
});

/** Is dit lidnummer al in gebruik binnen de tenant (optioneel excl. één user)? */
async function memberNumberTaken(tenantId: string, memberNumber: string, excludeUserId?: string) {
  const clash = await prisma.user.findFirst({
    where: {
      tenantId,
      memberNumber,
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    },
    select: { id: true },
  });
  return clash !== null;
}

export type MemberFormState = {
  error?: string;
  /** Bevestiging na een geslaagde toevoeging (incl. bezorgstatus van de uitnodiging). */
  notice?: string;
  noticeTone?: "success" | "warning";
};

/**
 * Lid handmatig toevoegen. Standaard gaat de uitnodiging er direct achteraan
 * (checkbox "Direct uitnodigen", vooraf aangevinkt) — zonder die mail heeft het
 * lid geen enkele manier om binnen te komen en blijft de rij op
 * "Niet uitgenodigd" staan tot iemand het handmatig alsnog doet.
 *
 * De uitnodiging is **best-effort**: mislukt de mail, dan blijft het lid gewoon
 * bestaan en meldt de UI dat het uitnodigen nog moet gebeuren (knop "Uitnodigen"
 * in de ledenlijst). Een mailstoring mag een ledenadministratie nooit blokkeren.
 */
export async function addMember(
  _prev: MemberFormState,
  formData: FormData
): Promise<MemberFormState> {
  const owner = await requireOwner();
  const invite = formData.get("invite") === "1";
  const parsed = addSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name") || "",
    memberNumber: formData.get("memberNumber") || "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ongeldige invoer" };
  const { email, name, memberNumber } = parsed.data;
  // Hier ontstaan uitsluitend sporters. Beheerders en medewerkers nodig je uit
  // op /owner/staff — de rol komt dus niet uit het formulier.
  const role = "TENANT_MEMBER" as const;

  const existing = await prisma.user.findUnique({
    where: { tenantId_email: { tenantId: owner.tenantId, email } },
    select: { id: true },
  });
  if (existing) return { error: "Dit e-mailadres bestaat al in deze sportschool" };

  if (memberNumber && (await memberNumberTaken(owner.tenantId, memberNumber))) {
    return { error: "Dit lidnummer is al in gebruik in deze sportschool" };
  }

  const user = await prisma.user.create({
    data: {
      tenantId: owner.tenantId,
      email,
      name: name || null,
      memberNumber: memberNumber || null,
      role,
      active: true,
      // Thuisvestiging: de actieve vestiging van de admin (device-cookie),
      // anders de default-vestiging (zie lib/location-resolve.ts).
      homeLocationId: await resolveActiveLocationId(owner.tenantId),
    },
  });
  await audit("user.create", { actor: owner, tenantId: owner.tenantId, targetType: "User", targetId: user.id, metadata: { email, role } });

  let notice = `${email} is toegevoegd. Er is nog geen uitnodiging verstuurd.`;
  let noticeTone: "success" | "warning" = "warning";
  if (invite) {
    try {
      const delivery = await createInvitation({
        tenantId: owner.tenantId,
        email,
        role,
        invitedById: owner.id,
        origin: await origin(),
        actor: owner,
      });
      await audit("user.invite", { actor: owner, tenantId: owner.tenantId, targetType: "Invitation", metadata: { email, role, delivery, onCreate: true } });
      if (delivery === "sent") {
        notice = `${email} is toegevoegd en heeft een uitnodiging ontvangen.`;
        noticeTone = "success";
      } else {
        notice = `${email} is toegevoegd, maar de uitnodigingsmail ging niet de deur uit. Verstuur hem opnieuw via de knop Uitnodigen.`;
      }
    } catch (err) {
      console.error(`[members] uitnodiging bij toevoegen mislukt voor ${email}:`, err);
      notice = `${email} is toegevoegd, maar het uitnodigen is mislukt. Gebruik de knop Uitnodigen in de ledenlijst.`;
    }
  }

  revalidatePath("/owner/members");
  return { notice, noticeTone };
}

const editSchema = z.object({
  userId: z.string().min(1),
  email: z.string().trim().email(),
  name: z.string().trim().max(120).optional().or(z.literal("")),
  memberNumber: z.string().trim().max(60).optional().or(z.literal("")),
  role: tenantRole,
});

export async function editMember(
  _prev: MemberFormState,
  formData: FormData
): Promise<MemberFormState> {
  const owner = await requireOwner();
  const parsed = editSchema.safeParse({
    userId: formData.get("userId"),
    email: formData.get("email"),
    name: formData.get("name") || "",
    memberNumber: formData.get("memberNumber") || "",
    role: formData.get("role"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ongeldige invoer" };
  const { userId, name, memberNumber, role } = parsed.data;
  const email = parsed.data.email.toLowerCase();

  const current = await prisma.user.findFirst({
    where: { id: userId, tenantId: owner.tenantId },
    select: { email: true, role: true },
  });
  if (!current) return { error: "Lid niet gevonden" };
  // Zelf-degradatie zou de eigenaar uit z'n eigen beheeromgeving zetten.
  const nextRole = userId === owner.id ? current.role : role;

  const emailChanged = email !== current.email.toLowerCase();
  if (emailChanged) {
    const clash = await prisma.user.findUnique({
      where: { tenantId_email: { tenantId: owner.tenantId, email } },
      select: { id: true },
    });
    if (clash) return { error: "Dit e-mailadres is al in gebruik in deze sportschool" };
  }

  if (memberNumber && (await memberNumberTaken(owner.tenantId, memberNumber, userId))) {
    return { error: "Dit lidnummer is al in gebruik in deze sportschool" };
  }

  await prisma.user.updateMany({
    where: { id: userId, tenantId: owner.tenantId },
    data: {
      name: name || null,
      memberNumber: memberNumber || null,
      role: nextRole,
      email,
      // Een openstaand zelf-service-wijzigingsverzoek naar het oude adres vervalt.
      ...(emailChanged
        ? { pendingEmail: null, emailChangeToken: null, emailChangeExpires: null }
        : {}),
    },
  });
  await audit("user.update", { actor: owner, tenantId: owner.tenantId, targetType: "User", targetId: userId, metadata: { name, role: nextRole } });
  if (nextRole !== current.role) {
    await audit("user.role.change", {
      actor: owner, tenantId: owner.tenantId, targetType: "User", targetId: userId,
      oldValue: { role: current.role }, newValue: { role: nextRole }, metadata: { role: nextRole },
    });
  }
  if (emailChanged) {
    await audit("user.email.change", {
      actor: owner,
      tenantId: owner.tenantId,
      targetType: "User",
      targetId: userId,
      oldValue: { email: current.email },
      newValue: { email },
      metadata: { newEmail: email },
    });
  }

  revalidatePath("/owner/members");
  revalidatePath(`/owner/members/${userId}`);
  // Wordt het een teamrol, dan verhuist de persoon naar de medewerkerspagina.
  if (nextRole !== current.role) revalidatePath("/owner/staff");
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
    // Zelfde regel als deactiveren: gearchiveerd = komt niet meer naar de les.
    if (archived) await releaseMemberClassSpots(owner.tenantId, userId, owner);
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

  const delivery = await createInvitation({
    tenantId: owner.tenantId,
    email: user.email,
    role: user.role,
    invitedById: owner.id,
    origin: await origin(),
    actor: owner,
  });
  await audit("user.invite.resend", { actor: owner, tenantId: owner.tenantId, targetType: "Invitation", metadata: { email: user.email, delivery } });

  revalidatePath("/owner/members");
  revalidatePath("/owner/staff");
}
