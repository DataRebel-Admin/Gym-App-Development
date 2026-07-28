"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireMember } from "@/lib/member";
import { areClassesEnabled } from "@/lib/classes";
import { ACTIVE_ENROLLMENT_STATUSES, canReenroll } from "@/lib/class-attendance";

/**
 * Meld aan voor een groepsles-sessie (atomair: respecteert maxParticipants).
 * Capaciteit telt alleen actieve statussen (ENROLLED/ATTENDED); een eerder
 * afgemelde rij wordt her-ingeschreven (CANCELLED → ENROLLED, zelfde rij).
 */
export async function enroll(formData: FormData) {
  const member = await requireMember();
  if (!(await areClassesEnabled(member.tenantId))) redirect("/member");
  const sessionId = String(formData.get("sessionId") ?? "");
  if (!sessionId) redirect("/member/rooster");

  await prisma.$transaction(async (tx) => {
    const session = await tx.classSession.findFirst({
      where: { id: sessionId, tenantId: member.tenantId },
      select: { id: true, groupClass: { select: { maxParticipants: true } } },
    });
    if (!session) return;

    const existing = await tx.classEnrollment.findUnique({
      where: { sessionId_userId: { sessionId, userId: member.id } },
      select: { id: true, status: true },
    });
    // Al aangemeld (of definitief aanwezig/no-show) → niets doen.
    if (existing && !canReenroll(existing.status)) return;

    const active = await tx.classEnrollment.count({
      where: { sessionId, status: { in: [...ACTIVE_ENROLLMENT_STATUSES] } },
    });
    if (active >= session.groupClass.maxParticipants) {
      return; // vol — geen aanmelding
    }

    if (existing) {
      await tx.classEnrollment.update({
        where: { id: existing.id },
        data: { status: "ENROLLED", statusChangedAt: new Date(), markedById: null },
      });
    } else {
      await tx.classEnrollment.create({
        data: { tenantId: member.tenantId, sessionId, userId: member.id },
      });
    }
  });

  revalidatePath("/member/rooster");
  redirect("/member/rooster");
}

/** Meld af: status-overgang ENROLLED → CANCELLED (rij blijft — no-show-analytics). */
export async function unenroll(formData: FormData) {
  const member = await requireMember();
  const sessionId = String(formData.get("sessionId") ?? "");
  if (!sessionId) redirect("/member/rooster");

  await prisma.classEnrollment.updateMany({
    where: { sessionId, userId: member.id, tenantId: member.tenantId, status: "ENROLLED" },
    data: { status: "CANCELLED", statusChangedAt: new Date() },
  });

  revalidatePath("/member/rooster");
  redirect("/member/rooster");
}
