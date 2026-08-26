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
 * Tijdvenster: aan- en afmelden kan tot de **start** van de les. Erna is de
 * aanmelding definitief (anders "poetst" een lid een no-show weg door vlak na
 * aanvang af te melden) en heeft aanmelden geen zin meer. Eén regel voor
 * beide richtingen; wijzig 'm hier, nooit ad hoc in een action.
 */
export function enrollmentWindowOpen(session: { startsAt: Date }, now: Date): boolean {
  return session.startsAt.getTime() > now.getTime();
}

/**
 * Uitkomst van een aanmeldpoging (pure beslissing; de server-action voert 'm
 * in een Serializable-transactie uit). `activeCount` = aantal plek-bezettende
 * aanmeldingen (ACTIVE_ENROLLMENT_STATUSES).
 */
export type EnrollDecision = "enrolled" | "waitlisted" | "closed" | "unchanged";

export function decideEnroll(input: {
  existingStatus: EnrollmentStatusValue | null;
  capacity: number;
  activeCount: number;
  windowOpen: boolean;
}): EnrollDecision {
  if (!input.windowOpen) return "closed";
  if (input.existingStatus && !canReenroll(input.existingStatus)) return "unchanged";
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
 * `REMINDER_WINDOW_HOURS` starten. Ruimer dan 24u zodat een dagelijkse run geen
 * les mist die net buiten het vorige venster viel; `remindedAt` maakt het
 * idempotent.
 */
export const REMINDER_WINDOW_HOURS = 30;

/** Maximaal aantal weken dat "wekelijks herhalen" in één keer inplant. */
export const MAX_REPEAT_WEEKS = 26;

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
