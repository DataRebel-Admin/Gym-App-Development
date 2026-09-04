"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireMember } from "@/lib/member";
import { areClassesEnabled } from "@/lib/classes";
import { audit } from "@/lib/audit";
import { withSerializableRetry } from "@/lib/db-retry";
import { promoteWaitlist } from "@/lib/class-enrollment";
import { notifyClassEvent, toSessionInfo, SESSION_INFO_SELECT } from "@/lib/class-notify";
import {
  ACTIVE_ENROLLMENT_STATUSES,
  canUnenroll,
  decideEnroll,
  enrollmentWindowOpen,
  sessionCapacity,
  type EnrollDecision,
} from "@/lib/class-attendance";

/** Terugkoppeling op /member/rooster (`?msg=`); vertaald in de pagina. */
export type RoosterMessage = EnrollDecision | "unenrolled";

function back(msg?: RoosterMessage, overlap = false): never {
  revalidatePath("/member/rooster");
  redirect(msg ? `/member/rooster?msg=${msg}${overlap ? "&overlap=1" : ""}` : "/member/rooster");
}

/**
 * Meld aan voor een groepsles-sessie. Regels (lib/class-attendance.ts):
 * tot de start; vol → wachtlijst; her-inschrijven hergebruikt de CANCELLED-rij.
 *
 * Draait **Serializable** met retry: onder READ COMMITTED zagen twee
 * gelijktijdige aanmeldingen dezelfde "nog 1 plek" en zaten er 13 in een les
 * van 12. Postgres breekt nu één van de twee af; die probeert het opnieuw en
 * ziet de bijgewerkte telling (lib/db-retry.ts).
 */
export async function enroll(formData: FormData) {
  const member = await requireMember();
  if (!(await areClassesEnabled(member.tenantId))) redirect("/member");
  const sessionId = String(formData.get("sessionId") ?? "");
  if (!sessionId) back();

  const result = await withSerializableRetry(() =>
    prisma.$transaction(
      async (tx) => {
        const session = await tx.classSession.findFirst({
          where: { id: sessionId, tenantId: member.tenantId },
          select: {
            ...SESSION_INFO_SELECT,
            maxParticipants: true,
            groupClass: { select: { name: true, maxParticipants: true } },
            venueLocation: { select: { timezone: true, archivedAt: true } },
          },
        });
        if (!session) return null;
        // Gearchiveerde vestiging = gesloten (defense-in-depth: archiveren is
        // geblokkeerd zolang er komende lessen staan, maar oude data kan bestaan).
        if (session.venueLocation.archivedAt) return { decision: "closed" as const, session };

        const existing = await tx.classEnrollment.findUnique({
          where: { sessionId_userId: { sessionId, userId: member.id } },
          select: { id: true, status: true },
        });
        const activeCount = await tx.classEnrollment.count({
          where: { sessionId, status: { in: [...ACTIVE_ENROLLMENT_STATUSES] } },
        });
        const decision = decideEnroll({
          existingStatus: existing?.status ?? null,
          capacity: sessionCapacity(session),
          activeCount,
          windowOpen: enrollmentWindowOpen(session, new Date()),
        });
        if (decision === "closed" || decision === "unchanged") return { decision, session };

        const status = decision === "enrolled" ? "ENROLLED" : "WAITLISTED";
        if (existing) {
          await tx.classEnrollment.update({
            where: { id: existing.id },
            // enrolledAt opnieuw: wachtlijstvolgorde = moment van (her)aanmelden.
            data: { status, statusChangedAt: new Date(), markedById: null, enrolledAt: new Date(), remindedAt: null },
          });
        } else {
          await tx.classEnrollment.create({
            data: { tenantId: member.tenantId, sessionId, userId: member.id, status },
          });
        }
        return { decision, session };
      },
      { isolationLevel: "Serializable" }
    )
  );

  if (!result) back();
  const { decision, session } = result;
  // Dubbelboeking is toegestaan (soms bewust), maar wél het melden waard:
  // overlapt deze les met een andere waarvoor het lid al (wachtlijst-)staat?
  // Read-only en ná de commit — geen extra conflictkans in de transactie.
  let overlap = false;
  if (decision === "enrolled" || decision === "waitlisted") {
    overlap =
      (await prisma.classEnrollment.count({
        where: {
          tenantId: member.tenantId,
          userId: member.id,
          status: { in: ["ENROLLED", "WAITLISTED"] },
          sessionId: { not: session.id },
          session: { startsAt: { lt: session.endsAt }, endsAt: { gt: session.startsAt } },
        },
      })) > 0;
  }
  if (decision === "enrolled" || decision === "waitlisted") {
    await audit(decision === "enrolled" ? "class.enroll" : "class.waitlist", {
      actor: member,
      tenantId: member.tenantId,
      targetType: "ClassSession",
      targetId: session.id,
      metadata: { class: session.groupClass.name },
    });
    await notifyClassEvent({
      tenantId: member.tenantId,
      kind: decision,
      session: toSessionInfo(session),
      userIds: [member.id],
      actor: member,
    });
  }
  back(decision, overlap);
}

/**
 * Meld af (ENROLLED/WAITLISTED → CANCELLED, rij blijft voor de no-show-
 * analytics). Alleen vóór de start; erna is de aanmelding definitief. Komt er
 * een plek vrij, dan schuift de eerste wachtende door (zelfde transactie) en
 * krijgt die een melding.
 */
export async function unenroll(formData: FormData) {
  const member = await requireMember();
  // Zelfde gate als enroll: module uit = in- en uitschrijven geblokkeerd
  // (lib/classes.ts); aanmeldingen blijven bewaard tot heractivering.
  if (!(await areClassesEnabled(member.tenantId))) redirect("/member");
  const sessionId = String(formData.get("sessionId") ?? "");
  if (!sessionId) back();

  const result = await withSerializableRetry(() =>
    prisma.$transaction(
      async (tx) => {
        const enrollment = await tx.classEnrollment.findFirst({
          where: { sessionId, userId: member.id, tenantId: member.tenantId },
          select: { id: true, status: true, session: { select: SESSION_INFO_SELECT } },
        });
        if (!enrollment || !canUnenroll(enrollment.status)) return { kind: "unchanged" as const };
        if (!enrollmentWindowOpen(enrollment.session, new Date())) return { kind: "closed" as const };

        await tx.classEnrollment.update({
          where: { id: enrollment.id },
          data: { status: "CANCELLED", statusChangedAt: new Date() },
        });
        const promoted =
          enrollment.status === "ENROLLED" ? await promoteWaitlist(tx, sessionId) : [];
        return { kind: "unenrolled" as const, session: enrollment.session, promoted };
      },
      { isolationLevel: "Serializable" }
    )
  );

  if (result.kind !== "unenrolled") back(result.kind);
  await audit("class.unenroll", {
    actor: member,
    tenantId: member.tenantId,
    targetType: "ClassSession",
    targetId: sessionId,
    metadata: { class: result.session.groupClass.name },
  });
  if (result.promoted.length > 0) {
    await notifyClassEvent({
      tenantId: member.tenantId,
      kind: "promoted",
      session: toSessionInfo(result.session),
      userIds: result.promoted,
      actor: member,
    });
  }
  back("unenrolled");
}
