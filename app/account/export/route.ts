import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAccount } from "@/lib/account";
import { audit } from "@/lib/audit";

/** Download alle persoonlijke accountgegevens als JSON (AVG-export). */
export async function GET() {
  const me = await requireAccount();

  const user = await prisma.user.findUnique({
    where: { id: me.id },
    select: {
      id: true, email: true, name: true, firstName: true, lastName: true,
      jobTitle: true, phone: true, timezone: true, locale: true, role: true,
      image: true, preferences: true, notificationPrefs: true, consents: true,
      createdAt: true,
      tenant: { select: { slug: true, name: true } },
    },
  });

  const sessions = await prisma.workoutSession.findMany({
    where: { userId: me.id },
    orderBy: { startedAt: "desc" },
    select: {
      startedAt: true, endedAt: true,
      performanceEntries: { select: { exerciseId: true, setNumber: true, reps: true, weightKg: true } },
    },
  });

  const enrollments = await prisma.classEnrollment.findMany({
    where: { userId: me.id },
    select: { enrolledAt: true, session: { select: { startsAt: true, groupClass: { select: { name: true } } } } },
  });

  const payload = {
    exportedAt: new Date().toISOString(),
    account: user,
    workoutSessions: sessions,
    classEnrollments: enrollments,
  };

  await audit("privacy.export", {
    actor: { id: me.id, email: me.email ?? null, role: me.role },
    tenantId: me.tenantId ?? null,
    targetType: "User",
    targetId: me.id,
  });

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="gymrebel-account-export.json"`,
      "Cache-Control": "no-store",
    },
  });
}
