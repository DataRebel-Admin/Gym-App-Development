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
import { uploadClassImage } from "@/lib/blob";
import { zonedInputToDate, shiftWallClock, wallClockDeltaMs } from "@/lib/tz";
import { withSerializableRetry } from "@/lib/db-retry";
import { expandWeeklyPlan } from "@/lib/class-planning";
import {
  MAX_REMIND_HOURS,
  MAX_REPEAT_WEEKS,
  MIN_REMIND_HOURS,
  attendanceOpen,
  canDeleteSession,
} from "@/lib/class-attendance";
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

/** Leeg formulierveld → null (= "volg de sportschool-standaard"). */
const optionalInt = (min: number, max: number) =>
  z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? null : v),
    z.coerce.number().int().min(min).max(max).nullable()
  );

const classSchema = z.object({
  name: z.string().trim().min(1, "nameRequired"),
  description: z.string().trim().max(1000).optional(),
  instructorName: z.string().trim().max(120).optional(),
  maxParticipants: z.coerce.number().int().min(1).max(200),
  /** Vaste instructeur (teamlid); leeg = geen. */
  defaultInstructorId: z.string().trim().optional(),
  // Boekingsregels: leeg = volg de sportschool (lib/class-attendance.ts).
  cancelDeadlineMinutes: optionalInt(0, 10080),
  bookingOpensDays: optionalInt(1, 365),
  maxBookingsPerWeek: optionalInt(0, 50),
  remindHoursBefore: optionalInt(MIN_REMIND_HOURS, MAX_REMIND_HOURS),
});

function classInput(formData: FormData) {
  return classSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    instructorName: formData.get("instructorName") || undefined,
    maxParticipants: formData.get("maxParticipants") || 12,
    defaultInstructorId: formData.get("defaultInstructorId") || undefined,
    cancelDeadlineMinutes: formData.get("cancelDeadlineMinutes"),
    bookingOpensDays: formData.get("bookingOpensDays"),
    maxBookingsPerWeek: formData.get("maxBookingsPerWeek"),
    remindHoursBefore: formData.get("remindHoursBefore"),
  });
}

/**
 * Een instructeur moet een actief teamlid van dezelfde sportschool zijn.
 * Onbekend of leeg → null (geen instructeur), nooit een id uit een ander
 * tenant — het formulierveld is gebruikersinvoer.
 */
async function resolveInstructorId(
  tenantId: string,
  requested: string | undefined
): Promise<string | null> {
  if (!requested) return null;
  const user = await prisma.user.findFirst({
    where: {
      id: requested,
      tenantId,
      active: true,
      archivedAt: null,
      role: { in: ["TENANT_ADMIN", "TENANT_STAFF"] },
    },
    select: { id: true },
  });
  return user?.id ?? null;
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
      defaultInstructorId: await resolveInstructorId(owner.tenantId, parsed.data.defaultInstructorId),
      cancelDeadlineMinutes: parsed.data.cancelDeadlineMinutes,
      bookingOpensDays: parsed.data.bookingOpensDays,
      maxBookingsPerWeek: parsed.data.maxBookingsPerWeek,
      remindHoursBefore: parsed.data.remindHoursBefore,
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
    select: {
      id: true,
      name: true,
      description: true,
      instructorName: true,
      maxParticipants: true,
      defaultInstructorId: true,
      cancelDeadlineMinutes: true,
      bookingOpensDays: true,
      maxBookingsPerWeek: true,
      remindHoursBefore: true,
    },
  });
  if (!before) return { error: t("classNotFound") };
  const defaultInstructorId = await resolveInstructorId(
    owner.tenantId,
    parsed.data.defaultInstructorId
  );

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
            defaultInstructorId,
            cancelDeadlineMinutes: parsed.data.cancelDeadlineMinutes,
            bookingOpensDays: parsed.data.bookingOpensDays,
            maxBookingsPerWeek: parsed.data.maxBookingsPerWeek,
            remindHoursBefore: parsed.data.remindHoursBefore,
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
 * Omslagfoto van een lestype instellen of verwijderen. Leegmaken zet het veld
 * op NULL → terugval op het sportschoollogo, dus "geen afbeelding" bestaat
 * niet als eindtoestand (zelfde 3-lagen-idee als lib/schema-image.ts).
 */
export async function setClassImage(_prev: ClassFormState, formData: FormData): Promise<ClassFormState> {
  const owner = await requirePermission("schedule:manage");
  await assertClassesEnabled(owner.tenantId);
  const t = await getTranslations("owner.rooster");
  const id = String(formData.get("id") ?? "");
  const remove = formData.get("remove") === "1";

  const groupClass = await prisma.groupClass.findFirst({
    where: { id, tenantId: owner.tenantId },
    select: { id: true, name: true, imageUrl: true, tenant: { select: { slug: true } } },
  });
  if (!groupClass) return { error: t("classNotFound") };

  let imageUrl: string | null = groupClass.imageUrl;
  if (remove) {
    imageUrl = null;
  } else {
    const file = formData.get("image");
    const uploaded = await uploadClassImage(
      file instanceof File ? file : null,
      groupClass.tenant.slug
    );
    if (!uploaded) return { error: t("imageFailed") };
    imageUrl = uploaded;
  }

  await prisma.groupClass.update({ where: { id: groupClass.id }, data: { imageUrl } });
  await audit("class.image.set", {
    actor: owner,
    tenantId: owner.tenantId,
    targetType: "GroupClass",
    targetId: groupClass.id,
    metadata: { name: groupClass.name, removed: String(remove) },
  });
  revalidatePath(`/owner/rooster/${groupClass.id}`);
  return { success: t("saved") };
}

/**
 * Lestype archiveren: uit het aanbod, maar sessies en aanwezigheidshistorie
 * blijven bestaan. Dít is wat een sportschool bedoelt met "we stoppen met
 * BodyPump" — verwijderen zou een jaar aanwezigheidsdata cascaderen
 * (precedent: Location/Exercise archiveren).
 *
 * Komende sessies worden geannuleerd (leden krijgen de bestaande
 * annuleringsmelding), zodat er niemand voor een les blijft staan die niet
 * meer gegeven wordt. Terugdraaien kan met dezelfde action.
 */
export async function setClassArchived(formData: FormData) {
  const owner = await requirePermission("schedule:manage");
  await assertClassesEnabled(owner.tenantId);
  const id = String(formData.get("id") ?? "");
  const archived = formData.get("archived") === "1";
  const scope = await getLocationScope(owner);

  const groupClass = await prisma.groupClass.findFirst({
    where: { id, tenantId: owner.tenantId },
    select: {
      id: true,
      name: true,
      archivedAt: true,
      sessions: {
        where: { startsAt: { gt: new Date() }, cancelledAt: null },
        select: {
          ...SESSION_INFO_SELECT,
          locationId: true,
          enrollments: {
            where: { status: { in: ["ENROLLED", "WAITLISTED"] } },
            select: { userId: true },
          },
        },
      },
    },
  });
  if (!groupClass) redirect("/owner/rooster");
  // Fail-closed, net als deleteClass: alleen archiveren als álle komende
  // sessies binnen de vestiging-scope van deze medewerker vallen.
  if (groupClass.sessions.some((s) => !canAccessLocation(scope, s.locationId))) notFound();

  const now = new Date();
  await prisma.groupClass.update({
    where: { id: groupClass.id },
    data: { archivedAt: archived ? now : null },
  });
  if (archived && groupClass.sessions.length > 0) {
    await prisma.classSession.updateMany({
      where: { id: { in: groupClass.sessions.map((s) => s.id) } },
      data: { cancelledAt: now },
    });
  }
  await audit(archived ? "class.archive" : "class.unarchive", {
    actor: owner,
    tenantId: owner.tenantId,
    targetType: "GroupClass",
    targetId: groupClass.id,
    metadata: { name: groupClass.name, cancelledSessions: archived ? groupClass.sessions.length : 0 },
  });
  if (archived) {
    for (const s of groupClass.sessions) {
      if (s.enrollments.length > 0) {
        await notifyClassEvent({
          tenantId: owner.tenantId,
          kind: "cancelled",
          session: toSessionInfo(s),
          userIds: s.enrollments.map((e) => e.userId),
          actor: owner,
        });
      }
    }
  }

  revalidatePath("/owner/rooster");
  revalidatePath(`/owner/rooster/${groupClass.id}`);
  redirect(`/owner/rooster/${groupClass.id}`);
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
  // Wie geeft déze les; leeg = de vaste instructeur van het lestype.
  instructorId: z.string().trim().optional(),
});

/** ISO-weekdagen uit het planformulier (checkboxes `weekdays`). */
function weekdayInput(formData: FormData): number[] {
  return formData
    .getAll("weekdays")
    .map((v) => Number.parseInt(String(v), 10))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 7);
}

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

  // Weekpatroon uitrollen (ma+wo+vr × N weken) via de klok van de vestiging,
  // zodat een reeks over de zomertijd heen op dezelfde lokale tijd blijft
  // staan. Zonder gekozen weekdagen is dit exact de oude wekelijkse reeks.
  const weekdays = weekdayInput(formData);
  const planned = expandWeeklyPlan({
    startsAt,
    endsAt,
    weekdays,
    weeks: repeatWeeks,
    timezone: venue.timezone,
  });
  // Een reeks is alles wat in één handeling is ingepland (ook meerdere dagen
  // per week): "verwijder ook alle volgende" hoort dan bij elkaar.
  const seriesId = planned.length > 1 ? randomUUID() : null;
  const instructorId = await resolveInstructorId(owner.tenantId, parsed.data.instructorId);
  const rows = planned.map((p) => ({
    tenantId: owner.tenantId,
    classId: groupClass.id,
    locationId: venue.id,
    startsAt: p.startsAt,
    endsAt: p.endsAt,
    location: parsed.data.location ?? null,
    maxParticipants: parsed.data.maxParticipants ?? null,
    instructorId,
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
    instructorId: true,
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
  const instructorId = await resolveInstructorId(owner.tenantId, parsed.data.instructorId);
  // Een vervanger is nieuws voor wie zich heeft aangemeld — daar kies je een
  // les op. Alleen melden als er écht iemand anders voor staat.
  const instructorChanged = instructorId !== before.instructorId;
  const newInstructor = instructorChanged && instructorId
    ? await prisma.user.findFirst({ where: { id: instructorId }, select: { name: true, email: true } })
    : null;

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
              instructorId,
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
    const sessionInfo = {
      id: r.session.id,
      className: r.session.groupClass.name,
      startsAt: r.startsAt,
      endsAt: r.endsAt,
      timezone: venue.timezone,
    };
    if (moved && r.session.enrollments.length > 0 && r.startsAt > now) {
      await notifyClassEvent({
        tenantId: owner.tenantId,
        kind: "moved",
        session: sessionInfo,
        userIds: r.session.enrollments.map((e) => e.userId),
        previous: { startsAt: r.session.startsAt, endsAt: r.session.endsAt },
        actor: owner,
      });
    }
    // Vervanger: aparte melding, want "de les is verplaatst" dekt dit niet.
    if (newInstructor && r.session.enrollments.length > 0 && r.startsAt > now) {
      await notifyClassEvent({
        tenantId: owner.tenantId,
        kind: "instructor",
        session: sessionInfo,
        userIds: r.session.enrollments.map((e) => e.userId),
        instructorName: newInstructor.name ?? newInstructor.email,
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
 * Markeer aanwezigheid van één deelnemer: ATTENDED, NO_SHOW of terug naar
 * ENROLLED (correctie). CANCELLED/WAITLISTED blijven onaangeroerd (die zaten
 * niet in de les). Vereist schedule:manage + toegang tot de vestiging.
 *
 * Bewust géén FormData-action met redirect: het aanwezigheidspaneel roept dit
 * per deelnemer optimistisch aan (patroon `saveSet` in de actieve training).
 * Eén les van twintig man kostte anders twintig volledige paginanavigaties op
 * een telefoon in de zaal.
 */
export type AttendanceResult = { ok: true } | { ok: false; error: string };

export async function setAttendance(input: {
  enrollmentId: string;
  status: "ATTENDED" | "NO_SHOW" | "ENROLLED";
}): Promise<AttendanceResult> {
  const owner = await requirePermission("schedule:manage");
  await assertClassesEnabled(owner.tenantId);
  const t = await getTranslations("owner.rooster");
  const { enrollmentId, status } = input;
  if (status !== "ATTENDED" && status !== "NO_SHOW" && status !== "ENROLLED") {
    return { ok: false, error: t("attendanceFailed") };
  }

  const enrollment = await prisma.classEnrollment.findFirst({
    where: { id: enrollmentId, tenantId: owner.tenantId },
    select: {
      id: true,
      status: true,
      user: { select: { name: true, email: true } },
      session: {
        select: {
          id: true,
          classId: true,
          locationId: true,
          startsAt: true,
          groupClass: { select: { name: true } },
        },
      },
    },
  });
  if (!enrollment || enrollment.status === "CANCELLED" || enrollment.status === "WAITLISTED") {
    return { ok: false, error: t("attendanceFailed") };
  }
  // Afvinken kan vanaf kort vóór de start (mensen lopen dan binnen), niet pas
  // ná afloop. Gedeelde regel met de UI (lib/class-attendance.ts).
  if (!attendanceOpen(enrollment.session, new Date())) {
    return { ok: false, error: t("attendanceNotOpen") };
  }
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
  revalidatePath(`/owner/rooster/sessie/${enrollment.session.id}`);
  revalidatePath(`/owner/rooster/${enrollment.session.classId}`);
  return { ok: true };
}

/**
 * "Iedereen aanwezig": alle nog niet gemarkeerde deelnemers in één keer op
 * ATTENDED. Dat is de normale uitkomst van een les — daarna markeert de
 * trainer alleen de paar afwezigen. Eén auditregel voor de hele groep (geen
 * ruis van twintig losse regels).
 */
export async function markAllPresent(sessionId: string): Promise<AttendanceResult> {
  const owner = await requirePermission("schedule:manage");
  await assertClassesEnabled(owner.tenantId);
  const t = await getTranslations("owner.rooster");

  const session = await prisma.classSession.findFirst({
    where: { id: sessionId, tenantId: owner.tenantId },
    select: { id: true, classId: true, locationId: true, startsAt: true, groupClass: { select: { name: true } } },
  });
  if (!session) return { ok: false, error: t("sessionNotFound") };
  if (!attendanceOpen(session, new Date())) return { ok: false, error: t("attendanceNotOpen") };
  const scope = await getLocationScope(owner);
  if (!canAccessLocation(scope, session.locationId)) notFound();

  const result = await prisma.classEnrollment.updateMany({
    where: { sessionId: session.id, tenantId: owner.tenantId, status: "ENROLLED" },
    data: { status: "ATTENDED", statusChangedAt: new Date(), markedById: owner.id },
  });
  if (result.count > 0) {
    await audit("class.attendance.mark", {
      actor: owner,
      tenantId: owner.tenantId,
      locationId: session.locationId,
      targetType: "ClassSession",
      targetId: session.id,
      metadata: { class: session.groupClass.name, status: "ATTENDED", count: result.count },
    });
  }
  revalidatePath(`/owner/rooster/sessie/${session.id}`);
  revalidatePath(`/owner/rooster/${session.classId}`);
  return { ok: true };
}
