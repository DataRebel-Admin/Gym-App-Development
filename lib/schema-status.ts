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

/** Verloop-status van een toegewezen schema o.b.v. de geldigheidsduur. */
export type ValidityState = "none" | "ok" | "expiring" | "expired";

export type Validity = {
  state: ValidityState;
  /** Wanneer het schema verloopt (null als er geen geldigheidsduur is ingesteld). */
  expiresAt: Date | null;
  /** Resterende dagen (negatief = verlopen; null = n.v.t.). */
  daysLeft: number | null;
  /** Badge-label ("Verlopen"/"Nieuw schema nodig"/…); "" als er niets te tonen is. */
  label: string;
  tone: BadgeTone;
};

/** Binnen hoeveel dagen voor verloop we "Nieuw schema nodig" tonen. */
export const VALIDITY_EXPIRING_WITHIN_DAYS = 14;

/**
 * Bereken de verloop-status van een toegewezen schema. `anchor` = het moment
 * waarop het lid het schema kreeg (publicatiedatum), `validityWeeks` = de
 * geldigheidsduur van het schema. Zonder geldigheidsduur of anker → "none".
 */
export function computeValidity(
  anchor: Date | null | undefined,
  validityWeeks: number | null | undefined,
  now: Date = new Date()
): Validity {
  if (!validityWeeks || validityWeeks <= 0 || !anchor) {
    return { state: "none", expiresAt: null, daysLeft: null, label: "", tone: "neutral" };
  }
  const expiresAt = new Date(anchor.getTime() + validityWeeks * 7 * 86_400_000);
  const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / 86_400_000);
  if (daysLeft <= 0) {
    return { state: "expired", expiresAt, daysLeft, label: "Verlopen", tone: "danger" };
  }
  if (daysLeft <= VALIDITY_EXPIRING_WITHIN_DAYS) {
    return { state: "expiring", expiresAt, daysLeft, label: "Nieuw schema nodig", tone: "warning" };
  }
  return { state: "ok", expiresAt, daysLeft, label: "Geldig", tone: "success" };
}

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

/**
 * Hoe lang geleden, kort NL: "vandaag", "1 dag", "5 dagen", "3 weken",
 * "4 maanden", "1 jaar 2 mnd". Bewust server-side berekend (geen client-side
 * `Date.now()`) zodat er geen hydration-mismatch ontstaat.
 */
export function fmtSince(d: Date | null | undefined, now: Date = new Date()): string {
  if (!d) return "—";
  const days = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (days <= 0) return "vandaag";
  if (days === 1) return "1 dag";
  if (days < 14) return `${days} dagen`;
  const weeks = Math.floor(days / 7);
  if (weeks < 9) return `${weeks} weken`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} maanden`;
  const years = Math.floor(days / 365);
  const remMonths = Math.floor((days - years * 365) / 30);
  return remMonths > 0 ? `${years} jaar ${remMonths} mnd` : years === 1 ? "1 jaar" : `${years} jaar`;
}

/**
 * Weergavenaam van de trainer die een schema toewees of een sessie draaide
 * (provenance). Naam heeft voorrang op e-mail; `null` als de trainer onbekend is
 * (bv. oude rijen zonder `assignedById`/`conductedById`). Puur — de call-site
 * kiest de fallbacktekst ("je trainer" voor het lid, "onbekend" voor de owner).
 */
export function trainerDisplayName(
  t: { name: string | null; email: string } | null | undefined
): string | null {
  if (!t) return null;
  const name = t.name?.trim();
  return name || t.email || null;
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
