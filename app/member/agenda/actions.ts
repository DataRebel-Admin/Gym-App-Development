"use server";

import { randomBytes } from "crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireMember } from "@/lib/member";
import { requireFeature } from "@/lib/features/service";
import { audit } from "@/lib/audit";
import { dayKeyInTz } from "@/lib/metrics/definitions";
import { getMemberCalendarTimezone } from "@/lib/calendar";
import { parseWeekdayPlan, type IsoWeekday } from "@/lib/calendar-plan";

export type SavePlanState = { ok?: boolean; error?: boolean };

/** dayId → ISO-weekdagen (1=ma … 7=zo). De client stuurt de volledige mapping. */
const planSchema = z.record(
  z.string().min(1),
  z.array(z.number().int().min(1).max(7)).max(7)
);

/**
 * Sla de weekdagplanning van het actieve schema op. Autoritatief: alleen de
 * eigen PUBLISHED-toewijzing, alleen dagen die écht in het template zitten.
 * `setAt` wordt bij de eerste keer gezet en daarna nooit meer aangepast (de
 * gemist-historie mag niet verschuiven door een bewerking). Lege mapping =
 * planning verwijderd (veld → NULL).
 */
export async function saveWeekdayPlan(formData: FormData): Promise<SavePlanState> {
  const member = await requireMember();
  await requireFeature(member.tenantId, "calendar");

  const assignmentId = String(formData.get("assignmentId") ?? "");
  let rawPlan: unknown;
  try {
    rawPlan = JSON.parse(String(formData.get("plan") ?? ""));
  } catch {
    return { error: true };
  }
  const parsed = planSchema.safeParse(rawPlan);
  if (!assignmentId || !parsed.success) return { error: true };

  const assignment = await prisma.assignedWorkout.findFirst({
    where: {
      id: assignmentId,
      tenantId: member.tenantId,
      userId: member.id,
      status: "PUBLISHED",
    },
    select: {
      weekdayPlan: true,
      template: { select: { days: { select: { id: true } } } },
    },
  });
  if (!assignment?.template) return { error: true };

  // Alleen dagen van dit template; lege dag-arrays vervallen.
  const validIds = new Set(assignment.template.days.map((d) => d.id));
  const days: Record<string, IsoWeekday[]> = {};
  for (const [dayId, weekdays] of Object.entries(parsed.data)) {
    if (!validIds.has(dayId) || weekdays.length === 0) continue;
    days[dayId] = [...new Set(weekdays)].sort((a, b) => a - b) as IsoWeekday[];
  }

  const plannedDays = Object.keys(days).length;
  let value: Prisma.InputJsonValue | typeof Prisma.DbNull = Prisma.DbNull;
  if (plannedDays > 0) {
    const existing = parseWeekdayPlan(assignment.weekdayPlan);
    const setAt =
      existing?.setAt ??
      dayKeyInTz(new Date(), await getMemberCalendarTimezone(member.id, member.tenantId));
    value = { setAt, days };
  }

  await prisma.assignedWorkout.update({
    where: { id: assignmentId },
    data: { weekdayPlan: value },
  });

  await audit("calendar.plan.set", {
    actor: { id: member.id, email: member.email, role: member.role },
    tenantId: member.tenantId,
    targetType: "AssignedWorkout",
    targetId: assignmentId,
    metadata: plannedDays > 0 ? { plannedDays } : {},
  });

  revalidatePath("/member/agenda");
  return { ok: true };
}

// ---------- ICS-feed beheren ----------
// De tokenwaarde komt nooit in audit-metadata (het is het geheim zelf).

function newFeedToken(): string {
  // 24 bytes hex (48 tekens) — zelfde entropie-klasse als de wachtwoord-reset.
  return randomBytes(24).toString("hex");
}

async function feedActor() {
  const member = await requireMember();
  await requireFeature(member.tenantId, "calendar");
  return member;
}

/** Maak de agendafeed aan (no-op als er al een token is — nooit stil roteren). */
export async function createCalendarFeed(): Promise<{ ok: boolean }> {
  const member = await feedActor();
  const { count } = await prisma.user.updateMany({
    where: { id: member.id, tenantId: member.tenantId, calendarFeedToken: null },
    data: { calendarFeedToken: newFeedToken() },
  });
  if (count > 0) {
    await audit("calendar.feed.create", {
      actor: { id: member.id, email: member.email, role: member.role },
      tenantId: member.tenantId,
      targetType: "User",
      targetId: member.id,
    });
  }
  revalidatePath("/member/agenda");
  return { ok: true };
}

/** Vernieuw de token: de oude feed-URL is per direct ongeldig. */
export async function rotateCalendarFeed(): Promise<{ ok: boolean }> {
  const member = await feedActor();
  const { count } = await prisma.user.updateMany({
    where: { id: member.id, tenantId: member.tenantId, calendarFeedToken: { not: null } },
    data: { calendarFeedToken: newFeedToken() },
  });
  if (count > 0) {
    await audit("calendar.feed.rotate", {
      actor: { id: member.id, email: member.email, role: member.role },
      tenantId: member.tenantId,
      targetType: "User",
      targetId: member.id,
    });
  }
  revalidatePath("/member/agenda");
  return { ok: true };
}

/** Trek de feed in: token weg, URL dood. */
export async function revokeCalendarFeed(): Promise<{ ok: boolean }> {
  const member = await feedActor();
  const { count } = await prisma.user.updateMany({
    where: { id: member.id, tenantId: member.tenantId, calendarFeedToken: { not: null } },
    data: { calendarFeedToken: null },
  });
  if (count > 0) {
    await audit("calendar.feed.revoke", {
      actor: { id: member.id, email: member.email, role: member.role },
      tenantId: member.tenantId,
      targetType: "User",
      targetId: member.id,
    });
  }
  revalidatePath("/member/agenda");
  return { ok: true };
}
