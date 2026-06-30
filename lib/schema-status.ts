import type { AssignmentStatus } from "@prisma/client";
import type { BadgeTone } from "@/components/ui/badge";

/**
 * Pure presentatie-helper voor de levenscyclus van een toegewezen schema (geen
 * server-only — bruikbaar in server- én client-componenten). Eén bron van
 * waarheid voor label + kleur per status.
 */
export const ASSIGNMENT_STATUS_META: Record<
  AssignmentStatus,
  { label: string; tone: BadgeTone }
> = {
  DRAFT: { label: "Concept", tone: "neutral" },
  SCHEDULED: { label: "Gepland", tone: "warning" },
  PUBLISHED: { label: "Gepubliceerd", tone: "success" },
  ARCHIVED: { label: "Gearchiveerd", tone: "neutral" },
};

/** Is dit schema nu daadwerkelijk zichtbaar voor het lid? */
export function isActiveNow(a: {
  status: AssignmentStatus;
  availableFrom: Date | null;
  endDate: Date | null;
}): boolean {
  if (a.status !== "PUBLISHED") return false;
  const now = Date.now();
  if (a.availableFrom && a.availableFrom.getTime() > now) return false;
  if (a.endDate && a.endDate.getTime() < now) return false;
  return true;
}

/** Korte NL-datum (zonder tijd). */
export function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short", year: "numeric" }).format(d);
}

/** NL-datum + tijd. */
export function fmtDateTime(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}
