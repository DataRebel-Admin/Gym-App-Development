// Pure aanwezigheids-/no-show-/wachtlijst-logica voor les-aanmeldingen
// (ClassEnrollment). Géén `server-only` (idioom lib/exercise-types.ts): ook
// client-bruikbaar (statuslabels) en testbaar via tsx (tests/class-attendance.test.ts).
//
// De status-waarden spiegelen `enum EnrollmentStatus` in prisma/schema.prisma;
// bewust een lokale string-union zodat dit bestand geen Prisma-runtime nodig heeft.

export type EnrollmentStatusValue =
  | "ENROLLED"
  | "CANCELLED"
  | "ATTENDED"
  | "NO_SHOW"
  | "WAITLISTED";

/**
 * Statussen die meetellen voor de capaciteit van een sessie. ATTENDED bestaat
 * alleen ná de les, maar meetellen houdt de invariant waterdicht (een als
 * aanwezig gemarkeerde deelnemer "bezet" zijn plek altijd). WAITLISTED bezet
 * per definitie géén plek.
 */
export const ACTIVE_ENROLLMENT_STATUSES = ["ENROLLED", "ATTENDED"] as const;

export function countsTowardCapacity(status: EnrollmentStatusValue): boolean {
  return (ACTIVE_ENROLLMENT_STATUSES as readonly string[]).includes(status);
}

/** Capaciteit van een sessie: eigen override (kleinere zaal) wint van de les-default. */
export function sessionCapacity(session: {
  maxParticipants: number | null;
  groupClass: { maxParticipants: number };
}): number {
  return session.maxParticipants ?? session.groupClass.maxParticipants;
}

/** Uitschrijven kan vanuit ENROLLED én WAITLISTED (na de les is de status definitief). */
export function canUnenroll(status: EnrollmentStatusValue): boolean {
  return status === "ENROLLED" || status === "WAITLISTED";
}

/** Her-inschrijven kan alleen vanuit CANCELLED (zelfde rij, uniek per sessie+lid). */
export function canReenroll(status: EnrollmentStatusValue): boolean {
  return status === "CANCELLED";
}

/**
 * Harde ondergrens: een les die begonnen is neemt geen aanmeldingen meer aan
 * en een aanmelding is dan definitief (anders "poetst" een lid een no-show weg
 * door vlak na aanvang af te melden). De sportschool kan er met
 * `BookingRules` strengere grenzen bovenop leggen; dit blijft het vangnet.
 */
export function enrollmentWindowOpen(session: { startsAt: Date }, now: Date): boolean {
  return session.startsAt.getTime() > now.getTime();
}

// ── Boekingsregels ──────────────────────────────────────────────────────────
// Per sportschool instelbaar (Tenant.class*) en per lestype te overschrijven
// (GroupClass.*). NULL op het lestype = volg de sportschool. Deze regels zijn
// puur en worden zowel door de UI (knop tonen/uitleggen) als door de
// server-action (autoritatief) gebruikt — nooit één van de twee alleen.

export type BookingRules = {
  /** Minuten vóór de start waarin afmelden niet meer kan (0 = tot de start). */
  cancelDeadlineMinutes: number;
  /** Hoeveel dagen vooruit een lid mag boeken. */
  bookingOpensDays: number;
  /** Maximaal aantal aanmeldingen per kalenderweek (null = onbeperkt). */
  maxBookingsPerWeek: number | null;
  /** No-shows binnen het venster waarna boeken blokkeert (null = geen beleid). */
  noShowLimit: number | null;
  /** Uren vóór de start waarop de herinnering uitgaat. */
  remindHoursBefore: number;
};

/** Sportschool-standaard (Tenant) + de override van het lestype (GroupClass). */
export type BookingRuleDefaults = {
  classCancelDeadlineMinutes: number;
  classBookingOpensDays: number;
  classMaxBookingsPerWeek: number | null;
  classNoShowLimit: number | null;
  classRemindHoursBefore: number;
};

export type BookingRuleOverrides = {
  cancelDeadlineMinutes: number | null;
  bookingOpensDays: number | null;
  maxBookingsPerWeek: number | null;
  remindHoursBefore: number | null;
};

/**
 * Dé resolutie van de boekingsregels: lestype-override wint van de
 * sportschool-standaard. Nooit ad hoc een `?? tenant.x` in een action
 * schrijven — dan lopen UI en server uiteen.
 *
 * `maxBookingsPerWeek` en `noShowLimit` behandelen 0 als "uit": een limiet van
 * nul zou élke aanmelding blokkeren, wat niemand bedoelt als hij het veld
 * leegmaakt.
 */
export function resolveBookingRules(
  groupClass: BookingRuleOverrides | null | undefined,
  tenant: BookingRuleDefaults
): BookingRules {
  const weekly = groupClass?.maxBookingsPerWeek ?? tenant.classMaxBookingsPerWeek;
  return {
    cancelDeadlineMinutes: Math.max(
      0,
      groupClass?.cancelDeadlineMinutes ?? tenant.classCancelDeadlineMinutes
    ),
    bookingOpensDays: Math.max(
      1,
      groupClass?.bookingOpensDays ?? tenant.classBookingOpensDays
    ),
    maxBookingsPerWeek: weekly && weekly > 0 ? weekly : null,
    noShowLimit:
      tenant.classNoShowLimit && tenant.classNoShowLimit > 0 ? tenant.classNoShowLimit : null,
    remindHoursBefore: clampReminderHours(
      groupClass?.remindHoursBefore ?? tenant.classRemindHoursBefore
    ),
  };
}

/** Grenzen aan de herinnering-voorsprong (de cron kijkt niet verder vooruit). */
export const MIN_REMIND_HOURS = 1;
export const MAX_REMIND_HOURS = 72;

export function clampReminderHours(hours: number): number {
  if (!Number.isFinite(hours)) return MIN_REMIND_HOURS;
  return Math.min(MAX_REMIND_HOURS, Math.max(MIN_REMIND_HOURS, Math.round(hours)));
}

/** Staat het aanmeldvenster open, is het nog te vroeg, of is het gesloten? */
export type EnrollWindow = "open" | "tooEarly" | "closed";

export function enrollWindowState(
  session: { startsAt: Date },
  now: Date,
  rules: Pick<BookingRules, "bookingOpensDays">
): EnrollWindow {
  if (!enrollmentWindowOpen(session, now)) return "closed";
  const horizon = now.getTime() + rules.bookingOpensDays * 24 * 3_600_000;
  return session.startsAt.getTime() > horizon ? "tooEarly" : "open";
}

/**
 * Mag het lid zich nu nog afmelden? Tot `cancelDeadlineMinutes` vóór de start.
 * De deadline bestaat zodat de wachtlijst nog kán doorschuiven: afmelden op
 * het laatste moment laat de plek gegarandeerd leeg.
 */
export function cancelWindowOpen(
  session: { startsAt: Date },
  now: Date,
  rules: Pick<BookingRules, "cancelDeadlineMinutes">
): boolean {
  const deadline = session.startsAt.getTime() - rules.cancelDeadlineMinutes * 60_000;
  return now.getTime() < deadline;
}

// ── No-show-beleid ──────────────────────────────────────────────────────────

/** Terugkijkvenster voor de no-show-teller (vast; alleen de limiet is instelbaar). */
export const NO_SHOW_WINDOW_DAYS = 30;

/**
 * Aantal no-shows binnen het venster. Puur, zodat zowel het ledenprofiel (de
 * coach ziet de teller) als de aanmeldactie (blokkade) dezelfde uitkomst
 * gebruiken. `rows` = de sessie-eindtijden van NO_SHOW-aanmeldingen.
 */
export function countNoShows(
  endedAtValues: readonly Date[],
  now: Date,
  windowDays: number = NO_SHOW_WINDOW_DAYS
): number {
  const cutoff = now.getTime() - windowDays * 24 * 3_600_000;
  return endedAtValues.filter((d) => d.getTime() >= cutoff).length;
}

/** Blokkeert het no-show-beleid deze aanmelding? Zonder limiet nooit. */
export function noShowBlocked(strikes: number, limit: number | null): boolean {
  return limit !== null && strikes >= limit;
}

/**
 * Uitkomst van een aanmeldpoging (pure beslissing; de server-action voert 'm
 * in een Serializable-transactie uit). `activeCount` = aantal plek-bezettende
 * aanmeldingen (ACTIVE_ENROLLMENT_STATUSES).
 *
 * Volgorde is bewust: eerst de harde poorten (venster, al aangemeld), dan het
 * beleid (no-show, weeklimiet), dan pas plek-of-wachtlijst. Zo krijgt het lid
 * de meest verklarende reden te zien, niet "wachtlijst" terwijl hij eigenlijk
 * geblokkeerd is.
 */
export type EnrollDecision =
  | "enrolled"
  | "waitlisted"
  | "closed"
  | "unchanged"
  | "tooEarly"
  | "weekLimit"
  | "noShowBlock";

export function decideEnroll(input: {
  existingStatus: EnrollmentStatusValue | null;
  capacity: number;
  activeCount: number;
  window: EnrollWindow;
  /** Actieve aanmeldingen van dit lid in dezelfde kalenderweek (deze niet meegeteld). */
  weekBookings: number;
  /** No-shows binnen het venster (zie [[countNoShows]]). */
  noShowStrikes: number;
  rules: Pick<BookingRules, "maxBookingsPerWeek" | "noShowLimit">;
}): EnrollDecision {
  if (input.window === "closed") return "closed";
  if (input.window === "tooEarly") return "tooEarly";
  if (input.existingStatus && !canReenroll(input.existingStatus)) return "unchanged";
  if (noShowBlocked(input.noShowStrikes, input.rules.noShowLimit)) return "noShowBlock";
  if (
    input.rules.maxBookingsPerWeek !== null &&
    input.weekBookings >= input.rules.maxBookingsPerWeek
  ) {
    return "weekLimit";
  }
  if (input.activeCount < input.capacity) return "enrolled";
  return "waitlisted";
}

/**
 * Hoeveel wachtenden kunnen doorschuiven? Gebruikt na afmelden en na het
 * verhogen van de capaciteit: vrije plekken = capaciteit − actieve aanmeldingen,
 * begrensd op de lengte van de wachtlijst en nooit negatief. Een verlaagde
 * capaciteit zet nooit iemand eruit (0, geen negatief getal).
 */
export function promotableCount(input: {
  capacity: number;
  activeCount: number;
  waitlistCount: number;
}): number {
  return Math.max(0, Math.min(input.capacity - input.activeCount, input.waitlistCount));
}

/**
 * Vlak vóór de start heeft doorschuiven geen zin meer: wie thuis zit ziet de
 * melding niet, maar de plek staat dan wél als bezet geboekt en niemand die er
 * wél is kan hem nog pakken. Binnen dit venster promoveren we dus niemand meer
 * en blijft de plek gewoon vrij.
 */
export const WAITLIST_PROMOTION_CUTOFF_MINUTES = 60;

export function waitlistPromotionOpen(
  session: { startsAt: Date },
  now: Date,
  cutoffMinutes: number = WAITLIST_PROMOTION_CUTOFF_MINUTES
): boolean {
  return session.startsAt.getTime() - now.getTime() > cutoffMinutes * 60_000;
}

/**
 * Vanaf wanneer staff aanwezigheid mag afvinken. In de praktijk vink je af
 * terwijl mensen binnenlopen, dus een kwartier vóór de start — niet pas ná
 * afloop, zoals de UI eerder deed.
 */
export const ATTENDANCE_LEAD_MINUTES = 15;

export function attendanceOpen(
  session: { startsAt: Date },
  now: Date,
  leadMinutes: number = ATTENDANCE_LEAD_MINUTES
): boolean {
  return now.getTime() >= session.startsAt.getTime() - leadMinutes * 60_000;
}

/**
 * Sessie verwijderbaar? Eén regel voor de UI én de server-action — die liepen
 * uiteen (UI: afgelopen + deelnemers, action: gestart + alle niet-afgemelde
 * rijen), waardoor een lopende les met deelnemers een verwijderknop toonde die
 * server-side stil niets deed. Regel: nog niet gestart, óf geen enkele
 * niet-afgemelde aanmelding (aanwezigheidshistorie beschermen; wachtenden
 * tellen mee tot de cron ze opruimt). `enrollmentCount` = rijen met status
 * ≠ CANCELLED.
 */
export function canDeleteSession(
  session: { startsAt: Date },
  enrollmentCount: number,
  now: Date
): boolean {
  return session.startsAt.getTime() > now.getTime() || enrollmentCount === 0;
}

/** Respijt na het einde van de les vóór de cron een ENROLLED als NO_SHOW markeert. */
export const NO_SHOW_GRACE_HOURS = 12;

/** Grens (endsAt op of vóór dit moment) waarna een ENROLLED-rij no-show wordt (cron). */
export function noShowCutoff(now: Date, graceHours: number = NO_SHOW_GRACE_HOURS): Date {
  return new Date(now.getTime() - graceHours * 3_600_000);
}

/**
 * Is deze aanmelding rijp om automatisch als no-show gemarkeerd te worden?
 * Alleen ENROLLED-rijen van sessies die ≥ `graceHours` geleden zijn afgelopen —
 * staff houdt zo een ruime marge om aanwezigheid handmatig te markeren.
 */
export function isNoShowEligible(
  enrollment: { status: EnrollmentStatusValue },
  session: { endsAt: Date },
  now: Date,
  graceHours: number = NO_SHOW_GRACE_HOURS
): boolean {
  if (enrollment.status !== "ENROLLED") return false;
  return session.endsAt.getTime() <= noShowCutoff(now, graceHours).getTime();
}

/**
 * Herinnering-venster (cron `class-reminders`, dagelijks): lessen die binnen
 * `MAX_REMIND_HOURS` starten; welke daarvan écht aan de beurt is bepaalt de
 * per-lestype-instelling (`resolveBookingRules`). `remindedAt` maakt het
 * idempotent.
 *
 * (De oude `REMINDER_WINDOW_HOURS` = 30 is vervallen met de overstap van een
 * dagelijkse naar een uurlijkse cron: het venster was toen tegelijk de
 * voorsprong, waardoor die varieerde van ongeveer een uur tot ruim een dag.)
 */

/** Maximaal aantal weken dat "wekelijks herhalen" in één keer inplant. */
export const MAX_REPEAT_WEEKS = 26;

/** Hoe ver het member-rooster vooruitkijkt (datumhorizon, geen rij-limiet). */
export const ROSTER_HORIZON_DAYS = 21;

export const ENROLLMENT_STATUS_META: Record<
  EnrollmentStatusValue,
  { label: string; tone: "neutral" | "positive" | "negative" | "muted" | "info" }
> = {
  ENROLLED: { label: "Aangemeld", tone: "neutral" },
  CANCELLED: { label: "Afgemeld", tone: "muted" },
  ATTENDED: { label: "Aanwezig", tone: "positive" },
  NO_SHOW: { label: "No-show", tone: "negative" },
  WAITLISTED: { label: "Wachtlijst", tone: "info" },
};
