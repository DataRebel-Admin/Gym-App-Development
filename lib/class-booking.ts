import "server-only";
import { cache } from "react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { addDaysZoned, zonedInputToDate } from "@/lib/tz";
import { weekStartKeyInTz } from "@/lib/metrics/definitions";
import {
  ACTIVE_ENROLLMENT_STATUSES,
  NO_SHOW_WINDOW_DAYS,
  countNoShows,
  resolveBookingRules,
  type BookingRuleDefaults,
  type BookingRules,
} from "@/lib/class-attendance";

/**
 * Serverlaag rond de boekingsregels (lib/class-attendance.ts is de pure kern).
 * Levert de sportschool-standaard, de per-lid tellingen die `decideEnroll`
 * nodig heeft, en het weekvenster waarin de weeklimiet telt.
 *
 * Gebruikt bewust de base `prisma`/de meegegeven transactie met een expliciete
 * `tenantId` (patroon lib/member-stats.ts): de aanmeldtransactie draait al
 * Serializable en mag er geen tweede client bij krijgen.
 */

/** Selectie van de sportschool-standaard (Tenant). */
export const BOOKING_DEFAULTS_SELECT = {
  classCancelDeadlineMinutes: true,
  classBookingOpensDays: true,
  classMaxBookingsPerWeek: true,
  classNoShowLimit: true,
  classRemindHoursBefore: true,
} as const;

/** Selectie van de per-lestype override (GroupClass). */
export const BOOKING_OVERRIDE_SELECT = {
  cancelDeadlineMinutes: true,
  bookingOpensDays: true,
  maxBookingsPerWeek: true,
  remindHoursBefore: true,
} as const;

const FALLBACK_DEFAULTS: BookingRuleDefaults = {
  classCancelDeadlineMinutes: 0,
  classBookingOpensDays: 60,
  classMaxBookingsPerWeek: null,
  classNoShowLimit: null,
  classRemindHoursBefore: 14,
};

/**
 * Sportschool-standaard, per request gememoïseerd: één pagina kan de regels
 * voor tientallen kaarten nodig hebben en dat is één en dezelfde rij.
 */
export const getClassBookingDefaults = cache(
  async (tenantId: string): Promise<BookingRuleDefaults> => {
    const t = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: BOOKING_DEFAULTS_SELECT,
    });
    return t ?? FALLBACK_DEFAULTS;
  }
);

/** Regels voor één lestype (override + standaard) in één aanroep. */
export async function getBookingRulesFor(
  tenantId: string,
  groupClass: {
    cancelDeadlineMinutes: number | null;
    bookingOpensDays: number | null;
    maxBookingsPerWeek: number | null;
    remindHoursBefore: number | null;
  } | null
): Promise<BookingRules> {
  return resolveBookingRules(groupClass, await getClassBookingDefaults(tenantId));
}

/**
 * De kalenderweek (maandag t/m zondag) waarin `date` valt, op de klok van
 * `timeZone`. De weeklimiet telt per week van de sportschool, niet per
 * rollend venster van 7 dagen — dat is wat een lid verwacht bij "3 lessen per
 * week" en het is voorspelbaar ("maandag mag ik weer").
 */
export function weekWindow(date: Date, timeZone: string): { from: Date; to: Date } {
  const mondayKey = weekStartKeyInTz(date, timeZone);
  const from =
    zonedInputToDate(`${mondayKey}T00:00`, timeZone) ?? new Date(`${mondayKey}T00:00:00Z`);
  return { from, to: addDaysZoned(from, 7, timeZone) };
}

type Tx = Prisma.TransactionClient;

/**
 * Hoeveel plek-bezettende aanmeldingen heeft dit lid al in de week van
 * `session`? De sessie zelf telt niet mee (die wordt juist beoordeeld).
 * Wachtlijst telt bewust **niet** mee: daar heeft het lid geen plek.
 */
export async function countWeekBookings(
  tx: Tx,
  input: { tenantId: string; userId: string; sessionId: string; startsAt: Date; timeZone: string }
): Promise<number> {
  const { from, to } = weekWindow(input.startsAt, input.timeZone);
  return tx.classEnrollment.count({
    where: {
      tenantId: input.tenantId,
      userId: input.userId,
      status: { in: [...ACTIVE_ENROLLMENT_STATUSES] },
      sessionId: { not: input.sessionId },
      session: { startsAt: { gte: from, lt: to }, cancelledAt: null },
    },
  });
}

/**
 * No-shows van dit lid binnen het terugkijkvenster. Telt op de eindtijd van de
 * les (wanneer je niet kwam opdagen), niet op het moment van markeren — anders
 * verschuift de teller door een late correctie van de trainer.
 */
export async function countRecentNoShows(
  tx: Tx,
  input: { tenantId: string; userId: string; now: Date }
): Promise<number> {
  const cutoff = new Date(input.now.getTime() - NO_SHOW_WINDOW_DAYS * 24 * 3_600_000);
  const rows = await tx.classEnrollment.findMany({
    where: {
      tenantId: input.tenantId,
      userId: input.userId,
      status: "NO_SHOW",
      session: { endsAt: { gte: cutoff } },
    },
    select: { session: { select: { endsAt: true } } },
  });
  return countNoShows(rows.map((r) => r.session.endsAt), input.now);
}
