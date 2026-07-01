"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/staff";
import { areClassesEnabled } from "@/lib/classes";
import { notifyStaffWithPermission } from "@/lib/staff-notify";

/** 404 als de groepslessen-module uit staat (Superadmin-flag óf owner-toggle). */
async function assertClassesEnabled(tenantId: string) {
  if (!(await areClassesEnabled(tenantId))) notFound();
}

const classSchema = z.object({
  name: z.string().trim().min(1, "Naam is verplicht"),
  instructorName: z.string().trim().optional(),
  maxParticipants: z.coerce.number().int().min(1).max(200),
});

export type ClassFormState = { error?: string };

export async function createClass(
  _prev: ClassFormState,
  formData: FormData
): Promise<ClassFormState> {
  const owner = await requirePermission("schedule:manage");
  await assertClassesEnabled(owner.tenantId);
  const parsed = classSchema.safeParse({
    name: formData.get("name"),
    instructorName: formData.get("instructorName") || undefined,
    maxParticipants: formData.get("maxParticipants") || 12,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ongeldige invoer" };
  }

  const created = await prisma.groupClass.create({
    data: {
      tenantId: owner.tenantId,
      name: parsed.data.name,
      instructorName: parsed.data.instructorName ?? null,
      maxParticipants: parsed.data.maxParticipants,
    },
  });

  revalidatePath("/owner/rooster");
  redirect(`/owner/rooster/${created.id}`);
}

export async function deleteClass(formData: FormData) {
  const owner = await requirePermission("schedule:manage");
  await assertClassesEnabled(owner.tenantId);
  const id = String(formData.get("id") ?? "");
  await prisma.groupClass.deleteMany({ where: { id, tenantId: owner.tenantId } });
  revalidatePath("/owner/rooster");
  redirect("/owner/rooster");
}

const sessionSchema = z
  .object({
    classId: z.string().min(1),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    location: z.string().trim().optional(),
  })
  .refine((d) => d.endsAt > d.startsAt, {
    message: "Eindtijd moet na de starttijd liggen",
  });

export type SessionFormState = { error?: string };

export async function addSession(
  _prev: SessionFormState,
  formData: FormData
): Promise<SessionFormState> {
  const owner = await requirePermission("schedule:manage");
  await assertClassesEnabled(owner.tenantId);
  const parsed = sessionSchema.safeParse({
    classId: formData.get("classId"),
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
    location: formData.get("location") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ongeldige invoer" };
  }

  const groupClass = await prisma.groupClass.findFirst({
    where: { id: parsed.data.classId, tenantId: owner.tenantId },
    select: { id: true, name: true },
  });
  if (!groupClass) return { error: "Les niet gevonden" };

  await prisma.classSession.create({
    data: {
      tenantId: owner.tenantId,
      classId: groupClass.id,
      startsAt: parsed.data.startsAt,
      endsAt: parsed.data.endsAt,
      location: parsed.data.location ?? null,
    },
  });

  // Informeer collega's die de planning beheren (niet jezelf).
  await notifyStaffWithPermission({
    tenantId: owner.tenantId,
    permission: "schedule:manage",
    category: "changes",
    render: (t) => ({
      title: t("notifications.newClass.title"),
      body: t("notifications.newClass.body", { name: groupClass.name }),
    }),
    link: `/owner/rooster/${groupClass.id}`,
    excludeUserId: owner.id,
  });

  revalidatePath(`/owner/rooster/${groupClass.id}`);
  return {};
}

export async function deleteSession(formData: FormData) {
  const owner = await requirePermission("schedule:manage");
  await assertClassesEnabled(owner.tenantId);
  const id = String(formData.get("id") ?? "");
  const classId = String(formData.get("classId") ?? "");
  await prisma.classSession.deleteMany({ where: { id, tenantId: owner.tenantId } });
  revalidatePath(`/owner/rooster/${classId}`);
  redirect(`/owner/rooster/${classId}`);
}
