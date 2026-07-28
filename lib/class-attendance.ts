// Pure aanwezigheids-/no-show-logica voor les-aanmeldingen (ClassEnrollment).
// Géén `server-only` (idioom lib/exercise-types.ts): ook client-bruikbaar
// (statuslabels) en testbaar via tsx (tests/class-attendance.test.ts).
//
// De status-waarden spiegelen `enum EnrollmentStatus` in prisma/schema.prisma;
// bewust een lokale string-union zodat dit bestand geen Prisma-runtime nodig heeft.

export type EnrollmentStatusValue = "ENROLLED" | "CANCELLED" | "ATTENDED" | "NO_SHOW";

/**
 * Statussen die meetellen voor de capaciteit van een sessie. ATTENDED bestaat
 * alleen ná de les, maar meetellen houdt de invariant waterdicht (een als
 * aanwezig gemarkeerde deelnemer "bezet" zijn plek altijd).
 */
export const ACTIVE_ENROLLMENT_STATUSES = ["ENROLLED", "ATTENDED"] as const;

export function countsTowardCapacity(status: EnrollmentStatusValue): boolean {
  return (ACTIVE_ENROLLMENT_STATUSES as readonly string[]).includes(status);
}

/** Uitschrijven kan alleen vanuit ENROLLED (na de les is de status definitief). */
export function canUnenroll(status: EnrollmentStatusValue): boolean {
  return status === "ENROLLED";
}

/** Her-inschrijven kan alleen vanuit CANCELLED (zelfde rij, uniek per sessie+lid). */
export function canReenroll(status: EnrollmentStatusValue): boolean {
  return status === "CANCELLED";
}

/** Respijt na het einde van de les vóór de cron een ENROLLED als NO_SHOW markeert. */
export const NO_SHOW_GRACE_HOURS = 12;

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
  return now.getTime() - session.endsAt.getTime() >= graceHours * 3_600_000;
}

export const ENROLLMENT_STATUS_META: Record<
  EnrollmentStatusValue,
  { label: string; tone: "neutral" | "positive" | "negative" | "muted" }
> = {
  ENROLLED: { label: "Aangemeld", tone: "neutral" },
  CANCELLED: { label: "Afgemeld", tone: "muted" },
  ATTENDED: { label: "Aanwezig", tone: "positive" },
  NO_SHOW: { label: "No-show", tone: "negative" },
};
