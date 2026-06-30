"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/staff";
import { memberBelongsToTenant } from "@/lib/coach-notes";
import { audit } from "@/lib/audit";

const addSchema = z.object({
  memberId: z.string().min(1),
  body: z.string().trim().min(1).max(5000),
  pinned: z.boolean().optional(),
});

export async function addCoachNote(formData: FormData) {
  const me = await requirePermission("coachnotes:manage");
  const parsed = addSchema.safeParse({
    memberId: formData.get("memberId"),
    body: formData.get("body"),
    pinned: formData.get("pinned") === "on",
  });
  if (!parsed.success) return;
  const { memberId, body, pinned } = parsed.data;

  if (!(await memberBelongsToTenant(me.tenantId, memberId))) return;

  await prisma.coachNote.create({
    data: { tenantId: me.tenantId, memberId, authorId: me.id, body, pinned: pinned ?? false },
  });
  await audit("coachnote.add", {
    actor: me,
    tenantId: me.tenantId,
    targetType: "User",
    targetId: memberId,
  });
  revalidatePath(`/owner/members/${memberId}/notes`);
}

const editSchema = z.object({
  noteId: z.string().min(1),
  memberId: z.string().min(1),
  body: z.string().trim().min(1).max(5000),
});

export async function updateCoachNote(formData: FormData) {
  const me = await requirePermission("coachnotes:manage");
  const parsed = editSchema.safeParse({
    noteId: formData.get("noteId"),
    memberId: formData.get("memberId"),
    body: formData.get("body"),
  });
  if (!parsed.success) return;
  const { noteId, memberId, body } = parsed.data;

  const res = await prisma.coachNote.updateMany({
    where: { id: noteId, tenantId: me.tenantId },
    data: { body },
  });
  if (res.count > 0) {
    await audit("coachnote.update", {
      actor: me,
      tenantId: me.tenantId,
      targetType: "User",
      targetId: memberId,
    });
  }
  revalidatePath(`/owner/members/${memberId}/notes`);
}

export async function toggleCoachNotePin(formData: FormData) {
  const me = await requirePermission("coachnotes:manage");
  const noteId = String(formData.get("noteId") ?? "");
  const memberId = String(formData.get("memberId") ?? "");
  const pinned = formData.get("pinned") === "true";
  if (!noteId || !memberId) return;

  await prisma.coachNote.updateMany({
    where: { id: noteId, tenantId: me.tenantId },
    data: { pinned },
  });
  revalidatePath(`/owner/members/${memberId}/notes`);
}

export async function deleteCoachNote(formData: FormData) {
  const me = await requirePermission("coachnotes:manage");
  const noteId = String(formData.get("noteId") ?? "");
  const memberId = String(formData.get("memberId") ?? "");
  if (!noteId || !memberId) return;

  const res = await prisma.coachNote.deleteMany({
    where: { id: noteId, tenantId: me.tenantId },
  });
  if (res.count > 0) {
    await audit("coachnote.delete", {
      actor: me,
      tenantId: me.tenantId,
      targetType: "User",
      targetId: memberId,
    });
  }
  revalidatePath(`/owner/members/${memberId}/notes`);
}
