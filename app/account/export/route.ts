import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
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

  // Oefeningnaam i.p.v. interne id, en `params` erbij: niet-kracht-logs
  // (cardio: duur/afstand/…) leven dáár — zonder die twee is de export voor de
  // gebruiker onleesbaar resp. incompleet (AVG: "intelligible form").
  const sessions = await prisma.workoutSession.findMany({
    where: { userId: me.id },
    orderBy: { startedAt: "desc" },
    select: {
      startedAt: true, endedAt: true,
      performanceEntries: {
        orderBy: { setNumber: "asc" },
        select: {
          setNumber: true, reps: true, weightKg: true, params: true,
          exercise: { select: { name: true } },
        },
      },
    },
  });

  // Lichaamsmetingen + voortgangsfoto's: gezondheidsdata, dus verplicht in de
  // export. De foto-URL's zijn de eigen beelden van het lid.
  const measurements = await prisma.measurement.findMany({
    where: { userId: me.id },
    orderBy: { measuredAt: "desc" },
    select: {
      measuredAt: true, source: true, notes: true,
      weightKg: true, bodyFatPct: true, muscleMassKg: true, fatMassKg: true,
      bmi: true, waterPct: true, boneMassKg: true, visceralFat: true,
      bmr: true, metabolicAge: true,
      chestCm: true, waistCm: true, hipsCm: true, neckCm: true,
      armLeftCm: true, armRightCm: true, thighLeftCm: true, thighRightCm: true,
      calfLeftCm: true, calfRightCm: true, restingHrBpm: true, extra: true,
      photos: { select: { pose: true, url: true, createdAt: true } },
    },
  });

  const goals = await prisma.memberGoal.findMany({
    where: { userId: me.id },
    orderBy: { createdAt: "desc" },
    select: {
      metric: true, startValue: true, targetValue: true, targetDate: true,
      achievedAt: true, createdAt: true,
    },
  });

  // Schema-aanvragen: eigen geschreven toelichting/opmerkingen van het lid.
  const schemaRequests = await prisma.schemaRequest.findMany({
    where: { userId: me.id },
    orderBy: { createdAt: "desc" },
    select: {
      kind: true, goal: true, description: true, notes: true,
      preferredStart: true, status: true, createdAt: true,
    },
  });

  // Zelfgebouwde schema's (origin=MEMBER): volledig eigen invoer van het lid.
  // Coach-toegewezen schema's blijven er bewust buiten — dat is content van de
  // sportschool, geen door het lid aangeleverde data.
  const selfBuiltSchemas = await prisma.assignedWorkout.findMany({
    where: { userId: me.id, origin: "MEMBER" },
    orderBy: { createdAt: "desc" },
    select: {
      createdAt: true, memberStatus: true, goal: true, focusNote: true,
      template: {
        select: {
          name: true,
          days: {
            orderBy: { order: "asc" },
            select: {
              name: true,
              items: {
                orderBy: { order: "asc" },
                select: {
                  sets: true, reps: true, weightKg: true, restSeconds: true,
                  tempo: true, params: true, notes: true,
                  exercise: { select: { name: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  // In-app-notificatiegeschiedenis (aan dit account gerichte berichten).
  const notifications = await prisma.notification.findMany({
    where: { userId: me.id },
    orderBy: { createdAt: "desc" },
    select: { category: true, title: true, body: true, readAt: true, createdAt: true },
  });

  const enrollments = await prisma.classEnrollment.findMany({
    where: { userId: me.id },
    select: {
      enrolledAt: true,
      status: true,
      statusChangedAt: true,
      session: { select: { startsAt: true, groupClass: { select: { name: true } } } },
    },
  });

  // App-meldingen aan het ontwikkelteam (anonieme meldingen hebben geen
  // reportedById en vallen hier per definitie buiten).
  const appReports = await prisma.appReport.findMany({
    where: { reportedById: me.id },
    orderBy: { createdAt: "desc" },
    select: {
      type: true, status: true, severity: true, title: true, description: true,
      contactAllowed: true, route: true, appVersion: true, platform: true,
      createdAt: true, resolvedAt: true,
    },
  });

  // Apparaatdefect-meldingen aan de sportschool (anonieme meldingen hebben
  // geen reportedById en vallen hier per definitie buiten).
  const equipmentDefects = await prisma.equipmentDefect.findMany({
    where: { reportedById: me.id },
    orderBy: { createdAt: "desc" },
    select: {
      machineLabel: true, symptom: true, severity: true, status: true,
      description: true, createdAt: true, resolvedAt: true, resolutionNote: true,
    },
  });

  // Weekdagplanning van de agenda: door het lid zelf ingevoerde data, dus mee
  // in de export. De feed-token blijft er bewust buiten (geheim, geen data).
  const weekdayPlans = await prisma.assignedWorkout.findMany({
    where: { userId: me.id, weekdayPlan: { not: Prisma.DbNull } },
    orderBy: { createdAt: "desc" },
    select: {
      createdAt: true,
      status: true,
      weekdayPlan: true,
      template: { select: { name: true } },
    },
  });

  const payload = {
    exportedAt: new Date().toISOString(),
    account: user,
    workoutSessions: sessions.map((s) => ({
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      performanceEntries: s.performanceEntries.map((e) => ({
        exercise: e.exercise.name,
        setNumber: e.setNumber,
        reps: e.reps,
        weightKg: e.weightKg,
        params: e.params,
      })),
    })),
    measurements,
    goals,
    schemaRequests,
    selfBuiltSchemas: selfBuiltSchemas.map((w) => ({
      createdAt: w.createdAt,
      status: w.memberStatus,
      goal: w.goal,
      focusNote: w.focusNote,
      name: w.template?.name ?? null,
      days: (w.template?.days ?? []).map((d) => ({
        name: d.name,
        exercises: d.items.map((i) => ({
          exercise: i.exercise.name,
          sets: i.sets,
          reps: i.reps,
          weightKg: i.weightKg,
          restSeconds: i.restSeconds,
          tempo: i.tempo,
          params: i.params,
          notes: i.notes,
        })),
      })),
    })),
    notifications,
    classEnrollments: enrollments,
    agendaWeekdayPlans: weekdayPlans.map((w) => ({
      schemaName: w.template?.name ?? null,
      status: w.status,
      createdAt: w.createdAt,
      weekdayPlan: w.weekdayPlan,
    })),
    appReports,
    equipmentDefects,
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
