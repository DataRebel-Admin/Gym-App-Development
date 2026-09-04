"use server";

import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect, notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/staff";
import { getTenantLocations } from "@/lib/locations";
import { getLocationScope } from "@/lib/location-access";
import { canAccessLocation, locationScopeWhere } from "@/lib/location-scope";
import { areClassesEnabled } from "@/lib/classes";
import { audit } from "@/lib/audit";
import { notifyStaffWithPermission } from "@/lib/staff-notify";
import { firstValidationError } from "@/lib/validation-message";
import { zonedInputToDate, addWeeksZoned, shiftWallClock, wallClockDeltaMs } from "@/lib/tz";
import { withSerializableRetry } from "@/lib/db-retry";
import { MAX_REPEAT_WEEKS, canDeleteSession } from "@/lib/class-attendance";
import { promoteWaitlists } from "@/lib/class-enrollment";
import {
  notifyClassEvent,
  notifyPromotions,
  toSessionInfo,
  SESSION_INFO_SELECT,
} from "@/lib/class-notify";

/** 404 als de groepslessen-module uit staat (Superadmin-flag óf owner-toggle). */
async function assertClassesEnabled(tenantId: string) {
  if (!(await areClassesEnabled(tenantId))) notFound();
}

export type ClassFormState = { error?: string; success?: string };
export type SessionFormState = { error?: string; success?: string };

const classSchema = z.object({
  name: z.string().trim().min(1, "nameRequired"),
  description: z.string().trim().max(1000).optional(),
  instructorName: z.string().trim().max(120).optional(),
  maxParticipants: z.coerce.number().int().min(1).max(200),
});

function classInput(formData: FormData) {
  return classSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    instructorName: formData.get("instructorName") || undefined,
    maxParticipants: formData.get("maxParticipants") || 12,
  });
}

export async function createClass(_prev: ClassFormState, formData: FormData): Promise<ClassFormState> {
  const owner = await requirePermission("schedule:manage");
  await assertClassesEnabled(owner.tenantId);
  const parsed = classInput(formData);
  if (!parsed.success) return { error: await firstValidationError(parsed.error) };

  const created = await prisma.groupClass.create({
    data: {
      tenantId: owner.tenantId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      instructorName: parsed.data.instructorName ?? null,
      maxParticipants: parsed.data.maxParticipants,
    },
  });
  await audit("class.create", {
    actor: owner,
    tenantId: owner.tenantId,
    targetType: "GroupClass",
    targetId: created.id,
    metadata: { name: created.name, maxParticipants: created.maxParticipants },
  });

  revalidatePath("/owner/rooster");
  redirect(`/owner/rooster/${created.id}`);
}

/**
 * Les bewerken (naam/omschrijving/instructeur/les-default capaciteit). Gaat
 * de capaciteit omhoog, dan schuiven wachtenden door op alle komende sessies
 * zónder eigen override.
 */
export async function updateClass(_prev: ClassFormState, formData: FormData): Promise<ClassFormState> {
  const owner = await requirePermission("schedule:manage");
  await assertClassesEnabled(owner.tenantId);
  const t = await getTranslations("owner.rooster");
  const id = String(formData.get("id") ?? "");
  const parsed = classInput(formData);
  if (!parsed.success) return { error: await firstValidationError(parsed.error) };

  const before = await prisma.groupClass.findFirst({
    where: { id, tenantId: owner.tenantId },
    select: { id: true, name: true, description: true, instructorName: true, maxParticipants: true },
  });
  if (!before) return { error: t("classNotFound") };

  // Serializable + retry, net als enroll/unenroll: de wachtlijst-promotie is
  // een count-then-write en moet in dezelfde isolatieklasse draaien als een
  // gelijktijdige aanmelding — anders zien beide dezelfde "vrije plek".
  const promoted = await withSerializableRetry(() =>
    prisma.$transaction(
      async (tx) => {
        await tx.groupClass.update({
          where: { id: before.id },
          data: {
            name: parsed.data.name,
            description: parsed.data.description ?? null,
            instructorName: parsed.data.instructorName ?? null,
            maxParticipants: parsed.data.maxParticipants,
          },
        });
        if (parsed.data.maxParticipants <= before.maxParticipants) return [];
        const upcoming = await tx.classSession.findMany({
          where: { classId: before.id, maxParticipants: null, startsAt: { gte: new Date() } },
          select: { id: true },
        });
        return promoteWaitlists(tx, upcoming.map((s) => s.id));
      },
      { isolationLevel: "Serializable" }
    )
  );

  await audit("class.update", {
    actor: owner,
    tenantId: owner.tenantId,
    targetType: "GroupClass",
    targetId: before.id,
    oldValue: before,
    newValue: { ...before, ...parsed.data },
    metadata: { name: parsed.data.name },
  });
  await notifyPromotions(owner.tenantId, promoted, owner);

  revalidatePath("/owner/rooster");
  revalidatePath(`/owner/rooster/${before.id}`);
  return { success: t("saved") };
}

/**
 * Les verwijderen (cascade: sessies + aanmeldingen). Medewerkers met een
 * vestiging-restrictie mogen dat alleen als álle sessies binnen hun scope
 * vallen. Leden die voor een komende sessie staan krijgen eerst een
 * annuleringsmelding.
 */
export async function deleteClass(formData: FormData) {
  const owner = await requirePermission("schedule:manage");
  await assertClassesEnabled(owner.tenantId);
  const id = String(formData.get("id") ?? "");
  const scope = await getLocationScope(owner);

  const groupClass = await prisma.groupClass.findFirst({
    where: { id, tenantId: owner.tenantId },
    select: {
      id: true,
      name: true,
      sessions: {
        select: {
          ...SESSION_INFO_SELECT,
          locationId: true,
          cancelledAt: true,
          enrollments: {
            where: { status: { in: ["ENROLLED", "WAITLISTED"] } },
            select: { userId: true },
          },
        },
      },
    },
  });
  if (!groupClass) redirect("/owner/rooster");
  if (groupClass.sessions.some((s) => !canAccessLocation(scope, s.locationId))) notFound();

  const now = new Date();
  // Al geannuleerde sessies overslaan: die leden zijn destijds al geïnformeerd.
  const future = groupClass.sessions.filter(
    (s) => s.startsAt > now && s.cancelledAt === null && s.enrollments.length > 0
  );
  await prisma.groupClass.delete({ where: { id: groupClass.id } });
  await audit("class.delete", {
    actor: owner,
    tenantId: owner.tenantId,
    targetType: "GroupClass",
    targetId: groupClass.id,
    metadata: { name: groupClass.name, sessions: groupClass.sessions.length },
  });
  for (const s of future) {
    await notifyClassEvent({
      tenantId: owner.tenantId,
      kind: "cancelled",
      session: toSessionInfo(s),
      userIds: s.enrollments.map((e) => e.userId),
      actor: owner,
    });
  }

  revalidatePath("/owner/rooster");
  redirect("/owner/rooster");
}

// ── Sessies ─────────────────────────────────────────────────────────────────

const sessionSchema = z.object({
  classId: z.string().min(1),
  // Klok van de vestiging (datetime-local); geparsed in de vestiging-tijdzone.
  startsAt: z.string().min(1, "invalidDate"),
  endsAt: z.string().min(1, "invalidDate"),
  locationId: z.string().min(1).optional(),
  // Zaal/ruimte bínnen de vestiging (vrije tekst); de vestiging is locationId.
  location: z.string().trim().max(120).optional(),
  // Capaciteit van deze sessie; leeg = les-default.
  maxParticipants: z.coerce.number().int().min(1).max(200).optional(),
});

/**
 * Vestiging kiezen + toegang afdwingen. Gevraagde vestiging moet actief zijn
 * en binnen de scope van de medewerker vallen; zonder keuze de eerste
 * toegankelijke vestiging (fail-closed: geen toegankelijke → null).
 */
async function resolveVenue(owner: Awaited<ReturnType<typeof requirePermission>>, requested?: string) {
  const [scope, locations] = await Promise.all([getLocationScope(owner), getTenantLocations(owner.tenantId)]);
  const allowed = locations.filter((l) => canAccessLocation(scope, l.id));
  const venue = requested ? allowed.find((l) => l.id === requested) : allowed[0];
  return venue ?? null;
}

/** Sessies ná deze (zelfde reeks) die nog moeten beginnen. */
function followingWhere(session: { seriesId: string | null; startsAt: Date; classId: string }) {
  return session.seriesId
    ? { seriesId: session.seriesId, startsAt: { gt: session.startsAt } }
    : { id: "__none__" };
}

export async function addSession(_prev: SessionFormState, formData: FormData): Promise<SessionFormState> {
  const owner = await requirePermission("schedule:manage");
  await assertClassesEnabled(owner.tenantId);
  const t = await getTranslations("owner.rooster");
  const parsed = sessionSchema.safeParse({
    classId: formData.get("classId"),
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
    locationId: formData.get("locationId") || undefined,
    location: formData.get("location") || undefined,
    maxParticipants: formData.get("maxParticipants") || undefined,
  });
  if (!parsed.success) return { error: await firstValidationError(parsed.error) };
  const repeatWeeks = Math.min(
    MAX_REPEAT_WEEKS,
    Math.max(0, Number.parseInt(String(formData.get("repeatWeeks") ?? "0"), 10) || 0)
  );

  const groupClass = await prisma.groupClass.findFirst({
    where: { id: parsed.data.classId, tenantId: owner.tenantId },
    select: { id: true, name: true },
  });
  if (!groupClass) return { error: t("classNotFound") };

  const venue = await resolveVenue(owner, parsed.data.locationId);
  if (!venue) return { error: t("locationNotAllowed") };

  const startsAt = zonedInputToDate(parsed.data.startsAt, venue.timezone);
  const endsAt = zonedInputToDate(parsed.data.endsAt, venue.timezone);
  const tv = await getTranslations("validation");
  if (!startsAt || !endsAt) return { error: tv("invalidDate") };
  if (endsAt <= startsAt) return { error: tv("endAfterStart") };

  const seriesId = repeatWeeks > 0 ? randomUUID() : null;
  const rows = Array.from({ length: repeatWeeks + 1 }, (_, i) => ({
    tenantId: owner.tenantId,
    classId: groupClass.id,
    locationId: venue.id,
    startsAt: i === 0 ? startsAt : addWeeksZoned(startsAt, i, venue.timezone),
    endsAt: i === 0 ? endsAt : addWeeksZoned(endsAt, i, venue.timezone),
    location: parsed.data.location ?? null,
    maxParticipants: parsed.data.maxParticipants ?? null,
    seriesId,
  }));
  await prisma.classSession.createMany({ data: rows });

  await audit("class.session.create", {
    actor: owner,
    tenantId: owner.tenantId,
    locationId: venue.id,
    targetType: "GroupClass",
    targetId: groupClass.id,
    metadata: { class: groupClass.name, count: rows.length, seriesId, startsAt: startsAt.toISOString() },
  });

  // Informeer collega's die de planning beheren (niet jezelf).
  await notifyStaffWithPermission({
    tenantId: owner.tenantId,
    permission: "schedule:manage",
    category: "changes",
    render: (tr) => ({
      title: tr("notifications.newClass.title"),
      body: tr("notifications.newClass.body", { name: groupClass.name }),
    }),
    link: `/owner/rooster/${groupClass.id}`,
    excludeUserId: owner.id,
  });

  revalidatePath(`/owner/rooster/${groupClass.id}`);
  revalidatePath("/owner/rooster");
  return { success: t("sessionsCreated", { count: rows.length }) };
}

/**
 * Sessie bewerken (tijd/vestiging/zaal/capaciteit). Tijd of vestiging
 * gewijzigd → "les gewijzigd"-melding aan aangemelde + wachtende leden;
 * capaciteit omhoog → wachtlijst schuift door.
 *
 * **"Ook alle volgende in deze reeks"** (`following=1`, alleen bij een
 * `seriesId`): dezelfde wijziging gaat mee naar de latere reeks-sessies binnen
 * de vestiging-scope. De tijdwijziging wordt als **klok**-verschuiving
 * toegepast (`wallClockDeltaMs`/`shiftWallClock`, lib/tz.ts): di 18:00→19:00
 * betekent óók 19:00 lokale tijd voorbij de DST-overgang. Vestiging, zaal en
 * capaciteit-override worden één-op-één overgenomen; per verschoven sessie
 * reset `remindedAt` en gaat een eigen moved-melding uit.
 */
export async function updateSession(_prev: SessionFormState, formData: FormData): Promise<SessionFormState> {
  const owner = await requirePermission("schedule:manage");
  await assertClassesEnabled(owner.tenantId);
  const t = await getTranslations("owner.rooster");
  const id = String(formData.get("id") ?? "");
  const following = formData.get("following") === "1";
  const parsed = sessionSchema.safeParse({
    classId: formData.get("classId"),
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
    locationId: formData.get("locationId") || undefined,
    location: formData.get("location") || undefined,
    maxParticipants: formData.get("maxParticipants") || undefined,
  });
  if (!parsed.success) return { error: await firstValidationError(parsed.error) };

  const scope = await getLocationScope(owner);
  // Bewust géén `as const`: readonly arrays breken Prisma's payload-inferentie
  // (zelfde valkuil als activeAssignmentWhere, zie CLAUDE.md).
  const sessionSelect = {
    ...SESSION_INFO_SELECT,
    classId: true,
    seriesId: true,
    locationId: true,
    location: true,
    maxParticipants: true,
    enrollments: {
      where: { status: { in: ["ENROLLED", "WAITLISTED"] } },
      select: { userId: true },
    },
  } satisfies Prisma.ClassSessionSelect;
  const before = await prisma.classSession.findFirst({
    where: { id, tenantId: owner.tenantId, classId: parsed.data.classId },
    select: sessionSelect,
  });
  if (!before) return { error: t("sessionNotFound") };
  if (!canAccessLocation(scope, before.locationId)) return { error: t("locationNotAllowed") };

  const venue = await resolveVenue(owner, parsed.data.locationId ?? before.locationId);
  if (!venue) return { error: t("locationNotAllowed") };

  const startsAt = zonedInputToDate(parsed.data.startsAt, venue.timezone);
  const endsAt = zonedInputToDate(parsed.data.endsAt, venue.timezone);
  const tv = await getTranslations("validation");
  if (!startsAt || !endsAt) return { error: tv("invalidDate") };
  if (endsAt <= startsAt) return { error: tv("endAfterStart") };

  // De reeks-verschuiving is de wijziging aan de doel-sessie, gemeten op de
  // klok van de (nieuwe) vestiging.
  const startDelta = wallClockDeltaMs(before.startsAt, startsAt, venue.timezone);
  const endDelta = wallClockDeltaMs(before.endsAt, endsAt, venue.timezone);

  // Serializable + retry (zie updateClass): promotie mag niet racen met een
  // gelijktijdige aanmelding.
  const result = await withSerializableRetry(() =>
    prisma.$transaction(
      async (tx) => {
        // Volgende reeks-sessies binnen de scope (fail-closed, zoals
        // deleteSession); geannuleerde sessies verschuiven niet mee.
        const followers =
          following && before.seriesId
            ? await tx.classSession.findMany({
                where: {
                  ...locationScopeWhere(owner.tenantId, scope),
                  ...followingWhere(before),
                  cancelledAt: null,
                },
                orderBy: { startsAt: "asc" },
                select: sessionSelect,
              })
            : [];
        const rows = [
          { session: before, startsAt, endsAt },
          ...followers.map((s) => ({
            session: s,
            startsAt: shiftWallClock(s.startsAt, startDelta, venue.timezone),
            endsAt: shiftWallClock(s.endsAt, endDelta, venue.timezone),
          })),
        ];
        for (const r of rows) {
          await tx.classSession.update({
            where: { id: r.session.id },
            data: {
              startsAt: r.startsAt,
              endsAt: r.endsAt,
              locationId: venue.id,
              location: parsed.data.location ?? null,
              maxParticipants: parsed.data.maxParticipants ?? null,
            },
          });
          // Verschoven starttijd → herinnering opnieuw: wie voor de oude tijd al
          // herinnerd was, hoort ook de nieuwe (cron is idempotent op remindedAt).
          if (r.session.startsAt.getTime() !== r.startsAt.getTime()) {
            await tx.classEnrollment.updateMany({
              where: { sessionId: r.session.id, status: { in: ["ENROLLED", "WAITLISTED"] } },
              data: { remindedAt: null },
            });
          }
        }
        const promoted = await promoteWaitlists(tx, rows.map((r) => r.session.id));
        return { rows, promoted };
      },
      { isolationLevel: "Serializable" }
    )
  );
  const { rows, promoted } = result;

  await audit("class.session.update", {
    actor: owner,
    tenantId: owner.tenantId,
    locationId: venue.id,
    targetType: "ClassSession",
    targetId: before.id,
    oldValue: {
      startsAt: before.startsAt.toISOString(),
      endsAt: before.endsAt.toISOString(),
      locationId: before.locationId,
      location: before.location,
      maxParticipants: before.maxParticipants,
    },
    newValue: {
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      locationId: venue.id,
      location: parsed.data.location ?? null,
      maxParticipants: parsed.data.maxParticipants ?? null,
    },
    metadata: { class: before.groupClass.name, following: rows.length - 1 },
  });

  // Moved-melding per sessie (elke reeks-sessie heeft z'n eigen oude tijd en
  // eigen deelnemers); alleen voor toekomstige sessies met aanmeldingen.
  const now = new Date();
  for (const r of rows) {
    const moved =
      r.session.startsAt.getTime() !== r.startsAt.getTime() ||
      r.session.endsAt.getTime() !== r.endsAt.getTime() ||
      r.session.locationId !== venue.id;
    if (moved && r.session.enrollments.length > 0 && r.startsAt > now) {
      await notifyClassEvent({
        tenantId: owner.tenantId,
        kind: "moved",
        session: {
          id: r.session.id,
          className: r.session.groupClass.name,
          startsAt: r.startsAt,
          endsAt: r.endsAt,
          timezone: venue.timezone,
        },
        userIds: r.session.enrollments.map((e) => e.userId),
        previous: { startsAt: r.session.startsAt, endsAt: r.session.endsAt },
        actor: owner,
      });
    }
  }
  await notifyPromotions(owner.tenantId, promoted, owner);

  revalidatePath(`/owner/rooster/${before.classId}`);
  revalidatePath("/owner/rooster");
  return { success: rows.length > 1 ? t("sessionsUpdated", { count: rows.length }) : t("saved") };
}

/**
 * Sessie verwijderen (optioneel: ook alle volgende in de reeks). Een
 * afgelopen sessie met deelnemers blijft bewaard (aanwezigheidshistorie).
 * Aangemelde + wachtende leden van komende sessies krijgen een
 * annuleringsmelding.
 */
export async function deleteSession(formData: FormData) {
  const owner = await requirePermission("schedule:manage");
  await assertClassesEnabled(owner.tenantId);
  const id = String(formData.get("id") ?? "");
  const classId = String(formData.get("classId") ?? "");
  const following = formData.get("following") === "1";
  const scope = await getLocationScope(owner);

  const target = await prisma.classSession.findFirst({
    where: { id, tenantId: owner.tenantId },
    select: { id: true, classId: true, seriesId: true, startsAt: true, locationId: true },
  });
  if (!target) redirect(`/owner/rooster/${classId}`);
  if (!canAccessLocation(scope, target.locationId)) notFound();

  const now = new Date();
  const candidates = await prisma.classSession.findMany({
    where: {
      ...locationScopeWhere(owner.tenantId, scope),
      OR: [{ id: target.id }, ...(following ? [followingWhere(target)] : [])],
    },
    select: {
      ...SESSION_INFO_SELECT,
      enrollments: {
        where: { status: { not: "CANCELLED" } },
        select: { userId: true, status: true },
      },
    },
  });
  // Historie beschermen: gestarte sessie mét aanmeldingen niet verwijderen
  // (gedeelde regel met de UI-knop, lib/class-attendance.ts).
  const deletable = candidates.filter((s) => canDeleteSession(s, s.enrollments.length, now));
  if (deletable.length === 0) redirect(`/owner/rooster/${target.classId}`);

  await prisma.classSession.deleteMany({ where: { id: { in: deletable.map((s) => s.id) } } });
  await audit("class.session.delete", {
    actor: owner,
    tenantId: owner.tenantId,
    locationId: target.locationId,
    targetType: "ClassSession",
    targetId: target.id,
    metadata: { class: deletable[0].groupClass.name, count: deletable.length, following },
  });
  for (const s of deletable) {
    const recipients = s.enrollments
      .filter((e) => e.status === "ENROLLED" || e.status === "WAITLISTED")
      .map((e) => e.userId);
    if (s.startsAt > now && recipients.length > 0) {
      await notifyClassEvent({
        tenantId: owner.tenantId,
        kind: "cancelled",
        session: toSessionInfo(s),
        userIds: recipients,
        actor: owner,
      });
    }
  }

  revalidatePath(`/owner/rooster/${target.classId}`);
  revalidatePath("/owner/rooster");
  redirect(`/owner/rooster/${target.classId}`);
}

/**
 * Sessie annuleren zónder verwijderen: `cancelledAt` bewaart de aanmeldlijst
 * (historie), de sessie is niet meer boekbaar (enroll → closed, geen
 * herinnering/no-show, wachtlijst promoot er niet in) en aangemelde +
 * wachtende leden krijgen de annuleringsmelding. Optioneel "ook alle volgende
 * in de reeks". Alleen komende, nog niet geannuleerde sessies; terugdraaien
 * kan met `restoreSession`.
 */
export async function cancelSession(formData: FormData) {
  const owner = await requirePermission("schedule:manage");
  await assertClassesEnabled(owner.tenantId);
  const id = String(formData.get("id") ?? "");
  const classId = String(formData.get("classId") ?? "");
  const following = formData.get("following") === "1";
  const scope = await getLocationScope(owner);

  const target = await prisma.classSession.findFirst({
    where: { id, tenantId: owner.tenantId },
    select: { id: true, classId: true, seriesId: true, startsAt: true, locationId: true },
  });
  if (!target) redirect(`/owner/rooster/${classId}`);
  if (!canAccessLocation(scope, target.locationId)) notFound();

  const now = new Date();
  const candidates = await prisma.classSession.findMany({
    where: {
      ...locationScopeWhere(owner.tenantId, scope),
      cancelledAt: null,
      startsAt: { gt: now },
      OR: [{ id: target.id }, ...(following ? [followingWhere(target)] : [])],
    },
    select: {
      ...SESSION_INFO_SELECT,
      enrollments: {
        where: { status: { in: ["ENROLLED", "WAITLISTED"] } },
        select: { userId: true },
      },
    },
  });
  if (candidates.length === 0) redirect(`/owner/rooster/${target.classId}`);

  await prisma.classSession.updateMany({
    where: { id: { in: candidates.map((c) => c.id) } },
    data: { cancelledAt: now },
  });
  await audit("class.session.cancel", {
    actor: owner,
    tenantId: owner.tenantId,
    locationId: target.locationId,
    targetType: "ClassSession",
    targetId: target.id,
    metadata: { class: candidates[0].groupClass.name, count: candidates.length, following },
  });
  for (const c of candidates) {
    if (c.enrollments.length > 0) {
      await notifyClassEvent({
        tenantId: owner.tenantId,
        kind: "cancelled",
        session: toSessionInfo(c),
        userIds: c.enrollments.map((e) => e.userId),
        actor: owner,
      });
    }
  }

  revalidatePath(`/owner/rooster/${target.classId}`);
  revalidatePath("/owner/rooster");
  redirect(`/owner/rooster/${target.classId}`);
}

/**
 * Annulering terugdraaien ("gaat toch door"): `cancelledAt` terug naar NULL,
 * de nog aangemelde + wachtende leden horen dat hun aanmelding weer staat.
 * Alleen voor komende sessies; per sessie (geen reeks-variant — herstellen is
 * een correctie, geen planhandeling).
 */
export async function restoreSession(formData: FormData) {
  const owner = await requirePermission("schedule:manage");
  await assertClassesEnabled(owner.tenantId);
  const id = String(formData.get("id") ?? "");
  const classId = String(formData.get("classId") ?? "");
  const scope = await getLocationScope(owner);

  const target = await prisma.classSession.findFirst({
    where: { id, tenantId: owner.tenantId, cancelledAt: { not: null }, startsAt: { gt: new Date() } },
    select: {
      ...SESSION_INFO_SELECT,
      classId: true,
      locationId: true,
      enrollments: {
        where: { status: { in: ["ENROLLED", "WAITLISTED"] } },
        select: { userId: true },
      },
    },
  });
  if (!target) redirect(`/owner/rooster/${classId}`);
  if (!canAccessLocation(scope, target.locationId)) notFound();

  await prisma.classSession.update({ where: { id: target.id }, data: { cancelledAt: null } });
  await audit("class.session.restore", {
    actor: owner,
    tenantId: owner.tenantId,
    locationId: target.locationId,
    targetType: "ClassSession",
    targetId: target.id,
    metadata: { class: target.groupClass.name },
  });
  if (target.enrollments.length > 0) {
    await notifyClassEvent({
      tenantId: owner.tenantId,
      kind: "restored",
      session: toSessionInfo(target),
      userIds: target.enrollments.map((e) => e.userId),
      actor: owner,
    });
  }

  revalidatePath(`/owner/rooster/${target.classId}`);
  revalidatePath("/owner/rooster");
  redirect(`/owner/rooster/${target.classId}`);
}

/**
 * Markeer aanwezigheid van een deelnemer (staff, ná de les): ATTENDED, NO_SHOW
 * of terug naar ENROLLED (correctie). CANCELLED/WAITLISTED blijven
 * onaangeroerd (die zaten niet in de les). Vereist schedule:manage + toegang
 * tot de vestiging van de sessie.
 */
export async function markAttendance(formData: FormData) {
  const owner = await requirePermission("schedule:manage");
  await assertClassesEnabled(owner.tenantId);
  const enrollmentId = String(formData.get("enrollmentId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (status !== "ATTENDED" && status !== "NO_SHOW" && status !== "ENROLLED") return;

  const enrollment = await prisma.classEnrollment.findFirst({
    where: { id: enrollmentId, tenantId: owner.tenantId },
    select: {
      id: true,
      status: true,
      user: { select: { name: true, email: true } },
      session: {
        select: { classId: true, locationId: true, startsAt: true, groupClass: { select: { name: true } } },
      },
    },
  });
  if (!enrollment || enrollment.status === "CANCELLED" || enrollment.status === "WAITLISTED") return;
  // Defense-in-depth: aanwezigheid bestaat pas vanaf de start van de les — de
  // UI toont de knoppen pas ná afloop, maar de action mag daar niet op leunen.
  if (enrollment.session.startsAt > new Date()) return;
  const scope = await getLocationScope(owner);
  if (!canAccessLocation(scope, enrollment.session.locationId)) notFound();

  await prisma.classEnrollment.update({
    where: { id: enrollment.id },
    data: { status, statusChangedAt: new Date(), markedById: owner.id },
  });
  await audit("class.attendance.mark", {
    actor: owner,
    tenantId: owner.tenantId,
    locationId: enrollment.session.locationId,
    targetType: "ClassEnrollment",
    targetId: enrollment.id,
    metadata: {
      member: enrollment.user.name ?? enrollment.user.email,
      class: enrollment.session.groupClass.name,
      status,
    },
  });
  revalidatePath(`/owner/rooster/${enrollment.session.classId}`);
}
