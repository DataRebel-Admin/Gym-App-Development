import type { AssignmentOrigin, AssignmentStatus, MemberSchemaStatus } from "@prisma/client";
import type { BadgeTone } from "@/components/ui/badge";

/**
 * Pure regels voor "schema's afwisselen" en "eenmalig trainen op een ander
 * schema" (geen `server-only`, ook client — idioom lib/member-schema-status.ts).
 * Gedeeld door de wisselpagina (welke knoppen), de server-actions (autoritatief)
 * en de teller op /member/schema (wanneer is wisselen zinvol).
 *
 * Eén schema is actief (`getAssignedSchema`); de rest staat klaar om naartoe te
 * wisselen of om eenmalig op te trainen. Verborgen blijven concepten, geweigerde
 * en geplande schema's (nog niet beschikbaar) en verlopen coach-schema's.
 */
export type SwitchRow = {
  origin: AssignmentOrigin;
  status: AssignmentStatus;
  memberStatus: MemberSchemaStatus | null;
  availableFrom: Date | null;
  endDate: Date | null;
  hasTemplate: boolean;
};

/** Verlopen (einddatum voorbij) of nog niet vrijgegeven (poort in de toekomst)? */
function outsideWindow(row: SwitchRow, now: Date): boolean {
  if (row.endDate && row.endDate.getTime() < now.getTime()) return true;
  if (row.availableFrom && row.availableFrom.getTime() > now.getTime()) return true;
  return false;
}

/**
 * Mag het lid dit schema (eenmalig) trainen? Eigen schema's zodra ze vastgelegd
 * zijn (ook tijdens een herbeoordeling — trainen stoort de coach niet); coach-
 * schema's zodra ze gepubliceerd zijn geweest, ook als een nieuwere toewijzing
 * ze heeft gearchiveerd. Nooit zonder inhoud (template weg).
 */
export function isTrainableSchema(row: SwitchRow, now: Date = new Date()): boolean {
  if (!row.hasTemplate || outsideWindow(row, now)) return false;
  if (row.origin === "MEMBER") {
    const s = row.memberStatus ?? "DRAFT";
    return s === "ACTIVE" || s === "PAUSED" || s === "APPROVED" || s === "IN_REVIEW";
  }
  return row.status === "PUBLISHED" || row.status === "ARCHIVED";
}

/**
 * Mag het lid dit schema actief maken? Als trainen, behalve zolang de coach het
 * beoordeelt: dan zou activeren de beoordeling omzeilen (`activate()` van de
 * builder zet memberStatus op ACTIVE).
 */
export function canMakeActive(row: SwitchRow, now: Date = new Date()): boolean {
  if (!isTrainableSchema(row, now)) return false;
  return !(row.origin === "MEMBER" && row.memberStatus === "IN_REVIEW");
}

export type SwitchState = "active" | "paused" | "approved" | "review" | "previous";

/** Toestand van een kandidaat op de wisselpagina (label + kleur). */
export function switchState(row: SwitchRow, isActive: boolean): SwitchState {
  if (isActive) return "active";
  if (row.origin === "MEMBER") {
    if (row.memberStatus === "IN_REVIEW") return "review";
    if (row.memberStatus === "APPROVED") return "approved";
    return "paused";
  }
  return "previous";
}

export const SWITCH_STATE_META: Record<SwitchState, { label: string; tone: BadgeTone }> = {
  active: { label: "Actief", tone: "success" },
  paused: { label: "Gepauzeerd", tone: "neutral" },
  approved: { label: "Goedgekeurd", tone: "success" },
  review: { label: "In beoordeling", tone: "warning" },
  previous: { label: "Eerder van je trainer", tone: "info" },
};

export const ORIGIN_LABEL: Record<AssignmentOrigin, string> = {
  COACH: "Van je trainer",
  MEMBER: "Zelf gemaakt",
};
