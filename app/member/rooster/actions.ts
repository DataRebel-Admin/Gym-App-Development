"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireMember } from "@/lib/member";
import { areClassesEnabled } from "@/lib/classes";

/** Meld aan voor een groepsles-sessie (atomair: respecteert maxParticipants). */
export async function enroll(formData: FormData) {
  const member = await requireMember();
  if (!(await areClassesEnabled(member.tenantId))) redirect("/member");
  const sessionId = String(formData.get("sessionId") ?? "");
  if (!sessionId) redirect("/member/rooster");

  await prisma.$transaction(async (tx) => {
    const session = await tx.classSession.findFirst({
      where: { id: sessionId, tenantId: member.tenantId },
      select: {
        id: true,
        groupClass: { select: { maxParticipants: true } },
        _count: { select: { enrollments: true } },
      },
    });
    if (!session) return;

    const already = await tx.classEnrollment.findUnique({
      where: { sessionId_userId: { sessionId, userId: member.id } },
      select: { id: true },
    });
    if (already) return; // al aangemeld

    if (session._count.enrollments >= session.groupClass.maxParticipants) {
      return; // vol — geen aanmelding
    }

    await tx.classEnrollment.create({
      data: { tenantId: member.tenantId, sessionId, userId: member.id },
    });
  });

  revalidatePath("/member/rooster");
  redirect("/member/rooster");
}

export async function unenroll(formData: FormData) {
  const member = await requireMember();
  const sessionId = String(formData.get("sessionId") ?? "");
  if (!sessionId) redirect("/member/rooster");

  await prisma.classEnrollment.deleteMany({
    where: { sessionId, userId: member.id, tenantId: member.tenantId },
  });

  revalidatePath("/member/rooster");
  redirect("/member/rooster");
}
