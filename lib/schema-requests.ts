import type {
  SchemaRequestGoal,
  SchemaRequestKind,
  SchemaRequestStatus,
} from "@prisma/client";
import type { BadgeTone } from "@/components/ui/badge";

/**
 * Pure presentatie-helpers voor schema-aanvragen (géén `server-only` — bruikbaar
 * in server- én client-componenten). Eén bron van waarheid voor labels + kleuren,
 * net als lib/schema-status.ts.
 */

/**
 * AANVRAAGTYPE — "aanpassing vragen" is bewust géén nieuw-schema-aanvraag.
 * Een lid dat z'n huidige schema wil bijstellen kiest geen doel en geen
 * startdatum; het vertelt wat er anders moet. De coach werkt het bestaande
 * schema bij i.p.v. een nieuw te bouwen. Beide typen leven naast elkaar in
 * `SchemaRequest.kind` en blokkeren elkaar niet (`canSubmitRequest`).
 */
export const REQUEST_KIND_META: Record<
  SchemaRequestKind,
  { label: string; tone: BadgeTone }
> = {
  NEW_SCHEMA: { label: "Nieuw schema", tone: "accent" },
  CHANGE: { label: "Aanpassing", tone: "warning" },
};

/** `?type=`-waarde per type; NEW_SCHEMA is de default en heeft er geen nodig. */
export const REQUEST_KIND_PARAM: Record<SchemaRequestKind, string | null> = {
  NEW_SCHEMA: null,
  CHANGE: "aanpassing",
};

/** Link naar het aanvraagformulier van een type (member-area). */
export function requestKindHref(kind: SchemaRequestKind): string {
  const param = REQUEST_KIND_PARAM[kind];
  return param ? `/member/requests?type=${param}` : "/member/requests";
}

/**
 * `?type=`-parameter → aanvraagtype. Accepteert de NL-waarde uit de links en de
 * enum-naam; alles anders valt terug op een nieuw-schema-aanvraag.
 */
export function parseRequestKind(
  value: string | string[] | undefined | null
): SchemaRequestKind {
  const raw = Array.isArray(value) ? value[0] : value;
  const v = raw?.trim().toLowerCase();
  return v === "aanpassing" || v === "change" ? "CHANGE" : "NEW_SCHEMA";
}

/**
 * Eén openstaande aanvraag **per type**: een aanpassingsverzoek mag niet
 * geblokkeerd worden door een lopende nieuw-schema-aanvraag (en omgekeerd) —
 * dat zijn verschillende vragen aan de coach. Twee keer hetzelfde type
 * openzetten blijft wél geblokkeerd (voorkomt wildgroei).
 */
export function canSubmitRequest(
  kind: SchemaRequestKind,
  openKinds: Iterable<SchemaRequestKind>
): boolean {
  for (const open of openKinds) {
    if (open === kind) return false;
  }
  return true;
}

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

/**
 * Statussen waarin een aanvraag nog actie van de coach vraagt. Eén bron van
 * waarheid: ook de `where`-filters van de server-actions lezen deze lijst.
 */
export const OPEN_REQUEST_STATUSES: SchemaRequestStatus[] = [
  "NEW",
  "IN_PROGRESS",
  "SCHEMA_CREATED",
];

/** Een aanvraag is "open" (vraagt nog actie van de coach) zolang niet afgerond/afgewezen/geannuleerd. */
export function isOpenRequest(status: SchemaRequestStatus): boolean {
  return OPEN_REQUEST_STATUSES.includes(status);
}

/**
 * INTREKKEN vs. VERWIJDEREN — twee verschillende dingen voor het lid, allebei
 * los van het aanvraagtype: een aanpassingsverzoek trek je net zo goed in als
 * een nieuw-schema-aanvraag.
 *
 * Intrekken mag op élke open status, óók SCHEMA_CREATED. Zou dat laatste niet
 * mogen, dan zit het lid vast: `isOpenRequest` telt SCHEMA_CREATED als open, dus
 * zolang de coach die niet afrondt blokkeert hij via `canSubmitRequest` elke
 * nieuwe aanvraag van hetzelfde type. Zelfde ontwerplijn als
 * `withdrawMemberSchema` (lib/member-schema-status.ts): vastzitten kan niet.
 */
export function canCancelRequest(status: SchemaRequestStatus): boolean {
  return isOpenRequest(status);
}

/**
 * Statussen waarin het lid een aanvraag definitief mag opruimen. Bewust níét:
 * - de open statussen — die trek je eerst in, zodat de coach niet stilzwijgend
 *   een vraag kwijtraakt waar hij op dat moment aan werkt;
 * - `COMPLETED` — die draagt de koppeling naar het opgeleverde schema
 *   (`resolvedAssignmentId`) en is dus historie van de sportschool, geen rommel.
 * Het feit zelf blijft hoe dan ook bewaard in het auditlog (dat heeft geen FK's
 * en overleeft de delete).
 */
export const DELETABLE_REQUEST_STATUSES: SchemaRequestStatus[] = [
  "CANCELLED",
  "REJECTED",
];

/** Mag het lid deze aanvraag uit de eigen lijst verwijderen? */
export function canDeleteRequest(status: SchemaRequestStatus): boolean {
  return DELETABLE_REQUEST_STATUSES.includes(status);
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
