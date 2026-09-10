// Pure planning-logica voor groepslessen: één weekpatroon uitrollen naar
// concrete sessies. Géén `server-only` (idioom lib/class-attendance.ts): de
// planform gebruikt het voor de voorvertoning ("dit maakt 36 lessen") en de
// server-action gebruikt exact dezelfde uitkomst om ze aan te maken.
//
// Alle datumrekenkunde loopt via lib/tz.ts, dus over een DST-overgang blijft
// "dinsdag 19:00" gewoon 19:00 lokale tijd.

import { addDaysZoned, isoWeekdayInTz, shiftWallClock, wallClockDeltaMs } from "@/lib/tz";

/** ISO-weekdagen, maandag eerst (1 = maandag … 7 = zondag). */
export const ISO_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

/**
 * Vangnet tegen een absurd plan (26 weken × 7 dagen = 182; hoger kan alleen
 * door te knoeien met het formulier). Voorkomt dat één POST duizenden rijen
 * aanmaakt.
 */
export const MAX_PLANNED_SESSIONS = 200;

export type PlannedSession = { startsAt: Date; endsAt: Date };

export type WeeklyPlanInput = {
  /** Eerste les: bepaalt tijd, duur en de week waarin het patroon begint. */
  startsAt: Date;
  endsAt: Date;
  /** ISO-weekdagen waarop de les valt. Leeg = alleen de dag van `startsAt`. */
  weekdays: readonly number[];
  /** Aantal wéken dat het patroon herhaalt ná de eerste week (0 = één week). */
  weeks: number;
  /** IANA-tijdzone van de vestiging. */
  timezone: string;
};

/**
 * Rolt een weekpatroon uit naar concrete sessies.
 *
 * De eerste les is het anker: haar klokstand (18:00) en duur gelden voor élke
 * gegenereerde sessie. Vanaf die week worden de gekozen weekdagen gevuld;
 * dagen die in de ánkerweek vóór het anker liggen vallen af (je plant geen les
 * in het verleden omdat je toevallig op woensdag "ook maandag" aanvinkt).
 *
 * Uitkomst is gesorteerd en ontdubbeld, zodat de caller er direct
 * `createMany` op kan doen.
 */
export function expandWeeklyPlan(input: WeeklyPlanInput): PlannedSession[] {
  const { startsAt, endsAt, timezone } = input;
  const weeks = Math.max(0, Math.floor(input.weeks));
  const anchorIso = isoWeekdayInTz(startsAt, timezone);
  const days = normalizeWeekdays(input.weekdays, anchorIso);
  // Duur als klok-delta: 18:00-19:00 blijft een uur, ook over de zomertijd.
  const durationMs = wallClockDeltaMs(startsAt, endsAt, timezone);

  const out: PlannedSession[] = [];
  const seen = new Set<number>();
  for (let week = 0; week <= weeks; week++) {
    for (const day of days) {
      const offset = day - anchorIso + week * 7;
      const start = offset === 0 ? startsAt : addDaysZoned(startsAt, offset, timezone);
      // Alleen in de ankerweek kan een gekozen dag vóór het anker liggen.
      if (start.getTime() < startsAt.getTime()) continue;
      if (seen.has(start.getTime())) continue;
      seen.add(start.getTime());
      out.push({
        startsAt: start,
        endsAt: offset === 0 ? endsAt : shiftWallClock(start, durationMs, timezone),
      });
      if (out.length >= MAX_PLANNED_SESSIONS) {
        return out.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
      }
    }
  }
  return out.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

/** Geldige, ontdubbelde, oplopende ISO-weekdagen; leeg → de ankerdag. */
export function normalizeWeekdays(
  weekdays: readonly number[],
  fallbackIso: number
): number[] {
  const valid = [...new Set(weekdays.filter((d) => Number.isInteger(d) && d >= 1 && d <= 7))];
  return valid.length > 0 ? valid.sort((a, b) => a - b) : [fallbackIso];
}

/**
 * Hoeveel sessies levert dit patroon op? Voor de live voorvertoning in het
 * planformulier — bewust dezelfde functie, geen tweede telregel.
 */
export function plannedSessionCount(input: WeeklyPlanInput): number {
  return expandWeeklyPlan(input).length;
}
