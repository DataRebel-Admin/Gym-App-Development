import type { SchemaRequestGoal, SchemaRequestStatus } from "@prisma/client";
import type { BadgeTone } from "@/components/ui/badge";

/**
 * Pure presentatie-helpers voor schema-aanvragen (géén `server-only` — bruikbaar
 * in server- én client-componenten). Eén bron van waarheid voor labels + kleuren,
 * net als lib/schema-status.ts.
 */

export const REQUEST_GOAL_LABELS: Record<SchemaRequestGoal, string> = {
  MUSCLE: "Spiermassa opbouwen",
  WEIGHT_LOSS: "Afvallen",
  CONDITION: "Conditie verbeteren",
  REHAB: "Revalidatie",
  STRENGTH: "Krachttraining",
  OTHER: "Anders",
};

/** Opties voor de doel-select (in vaste, logische volgorde). */
export const GOAL_OPTIONS: { value: SchemaRequestGoal; label: string }[] = (
  ["MUSCLE", "WEIGHT_LOSS", "CONDITION", "REHAB", "STRENGTH", "OTHER"] as const
).map((value) => ({ value, label: REQUEST_GOAL_LABELS[value] }));

export const REQUEST_STATUS_META: Record<
  SchemaRequestStatus,
  { label: string; tone: BadgeTone }
> = {
  NEW: { label: "Nieuw", tone: "accent" },
  IN_PROGRESS: { label: "In behandeling", tone: "warning" },
  SCHEMA_CREATED: { label: "Schema aangemaakt", tone: "accent" },
  COMPLETED: { label: "Afgerond", tone: "success" },
  REJECTED: { label: "Afgewezen", tone: "danger" },
  CANCELLED: { label: "Geannuleerd", tone: "neutral" },
};

/** Een aanvraag is "open" (vraagt nog actie van de coach) zolang niet afgerond/afgewezen/geannuleerd. */
export function isOpenRequest(status: SchemaRequestStatus): boolean {
  return status === "NEW" || status === "IN_PROGRESS" || status === "SCHEMA_CREATED";
}

/** Overzicht-filters (owner) → bijbehorende statussen. */
export const REQUEST_FILTERS = {
  new: ["NEW"],
  progress: ["IN_PROGRESS", "SCHEMA_CREATED"],
  done: ["COMPLETED"],
  rejected: ["REJECTED", "CANCELLED"],
} satisfies Record<string, SchemaRequestStatus[]>;

export type RequestFilter = keyof typeof REQUEST_FILTERS;

export const REQUEST_FILTER_LABELS: Record<RequestFilter, string> = {
  new: "Nieuw",
  progress: "In behandeling",
  done: "Afgerond",
  rejected: "Afgewezen",
};
