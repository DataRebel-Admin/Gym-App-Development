import type { AssignmentStatus, MemberSchemaMode, MemberSchemaStatus } from "@prisma/client";
import type { BadgeTone } from "@/components/ui/badge";

/**
 * Pure presentatie-helpers voor zelf-gebouwde lid-schema's (géén `server-only` —
 * bruikbaar in server- én client-componenten). Eén bron van waarheid voor label +
 * kleur per lid-status, net als lib/schema-status.ts / lib/schema-requests.ts.
 */

export const MEMBER_STATUS_META: Record<
  MemberSchemaStatus,
  { label: string; tone: BadgeTone; description: string }
> = {
  DRAFT: {
    label: "Concept",
    tone: "neutral",
    description: "Nog in bewerking. Werk verder of dien in.",
  },
  IN_REVIEW: {
    label: "In beoordeling",
    tone: "warning",
    description: "Je coach bekijkt je schema.",
  },
  APPROVED: {
    label: "Goedgekeurd",
    tone: "success",
    description: "Goedgekeurd. Activeer om ermee te trainen.",
  },
  REJECTED: {
    label: "Geweigerd",
    tone: "danger",
    description: "Je coach vraagt om aanpassingen.",
  },
  ACTIVE: {
    label: "Actief",
    tone: "success",
    description: "Je traint nu met dit schema.",
  },
  PAUSED: {
    label: "Gepauzeerd",
    tone: "neutral",
    description: "Tijdelijk gepauzeerd.",
  },
};

/**
 * Kan het lid dit schema bewerken? Een zelf-gebouwd schema blijft van het lid —
 * ook ná goedkeuring/activering. Alleen tijdens de beoordeling ligt het vast
 * (anders beoordeelt de coach een bewegend doel); het lid kan de indiening dan
 * intrekken (zie `isWithdrawableMemberStatus`) om verder te werken.
 */
export function isEditableMemberStatus(status: MemberSchemaStatus): boolean {
  return status !== "IN_REVIEW";
}

/** Wacht dit schema op de coach? */
export function isPendingReview(status: MemberSchemaStatus): boolean {
  return status === "IN_REVIEW";
}

/** Kan het lid zijn indiening intrekken (terug naar bewerken)? */
export function isWithdrawableMemberStatus(status: MemberSchemaStatus): boolean {
  return status === "IN_REVIEW";
}

/**
 * Is dit schema al een keer vastgelegd (goedgekeurd, in gebruik of gepauzeerd)?
 * Zulke schema's bewerkt het lid "live": wijzigingen landen meteen in het schema
 * en de commit-knop dient ze (bij APPROVAL) opnieuw in ter controle.
 */
export function isCommittedMemberStatus(status: MemberSchemaStatus): boolean {
  return status === "APPROVED" || status === "ACTIVE" || status === "PAUSED";
}

/**
 * Waar keert een ingetrokken indiening naar terug? Volgt de zichtbaarheidspoort
 * (`AssignedWorkout.status`), zodat een lopend schema actief blijft en een
 * gepauzeerd schema gepauzeerd — precies de staat van vóór het indienen.
 */
export function statusAfterWithdraw(visibility: AssignmentStatus): MemberSchemaStatus {
  if (visibility === "PUBLISHED") return "ACTIVE";
  if (visibility === "ARCHIVED") return "PAUSED";
  return "DRAFT";
}

/**
 * Heeft het lid een al beoordeeld schema aangepast zonder de wijziging opnieuw in
 * te dienen? Puur afgeleid uit tijdstempels (`WorkoutTemplate.updatedAt` vs. het
 * laatste review-moment) — geen extra kolom nodig. Zonder review-nullijn (nooit
 * beoordeeld, bv. DIRECT-modus) is er niets te melden.
 */
export function hasUnsubmittedChanges(input: {
  status: MemberSchemaStatus;
  needsApproval: boolean;
  contentUpdatedAt: Date | string | null;
  reviewedAt: Date | string | null;
}): boolean {
  if (!input.needsApproval) return false;
  if (!isCommittedMemberStatus(input.status)) return false;
  if (!input.contentUpdatedAt || !input.reviewedAt) return false;
  return new Date(input.contentUpdatedAt).getTime() > new Date(input.reviewedAt).getTime();
}

/**
 * Bepaalt of een zelf-gebouwd schema goedkeuring nodig heeft, gegeven de tenant-
 * modus en een eventuele kader-override (`requireApproval`). DIRECT zonder
 * override → geen goedkeuring; APPROVAL of override=true → wel.
 */
export function requiresApproval(
  mode: MemberSchemaMode,
  frameworkRequireApproval: boolean | null | undefined
): boolean {
  if (frameworkRequireApproval === true) return true;
  if (frameworkRequireApproval === false) return false;
  return mode === "APPROVAL";
}
