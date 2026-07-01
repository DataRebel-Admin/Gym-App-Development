import type { MemberSchemaMode, MemberSchemaStatus } from "@prisma/client";
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
    description: "Nog in bewerking — werk verder of dien in.",
  },
  IN_REVIEW: {
    label: "In beoordeling",
    tone: "warning",
    description: "Je coach bekijkt je schema.",
  },
  APPROVED: {
    label: "Goedgekeurd",
    tone: "success",
    description: "Goedgekeurd — activeer om ermee te trainen.",
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

/** Kan het lid dit schema nog bewerken? (Concept of na afwijzing.) */
export function isEditableMemberStatus(status: MemberSchemaStatus): boolean {
  return status === "DRAFT" || status === "REJECTED";
}

/** Wacht dit schema op de coach? */
export function isPendingReview(status: MemberSchemaStatus): boolean {
  return status === "IN_REVIEW";
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
