// Pure defect-helpers (geen Prisma/server-only import) zodat dit ook in Client
// Components veilig te gebruiken is — idioom van lib/maintenance.ts /
// lib/exercise-types.ts. Eén bron van waarheid voor de symptomenlijst, labels,
// kleuren, de bevestigings-drempel en de severity-bump-regel.
import type { DefectStatus, DefectSeverity, MachineType } from "@prisma/client";
import type { BadgeTone } from "@/components/ui/badge";

// --- Symptomen (vaste keuzelijst — vrije tekst levert onbruikbare meldingen) --

export type DefectSymptomKey =
  | "noise" // maakt raar geluid
  | "pin" // pin of gewichtspen kapot of kwijt
  | "cable" // kabel of riem beschadigd
  | "stuck" // zit vast of loopt stroef
  | "electronics" // scherm of elektronica doet het niet
  | "loose" // onderdeel los of ontbreekt
  | "upholstery" // zitting of bekleding beschadigd
  | "other"; // anders

export type DefectSymptom = {
  key: DefectSymptomKey;
  /** NL-label voor niet-i18n contexten (audit-zinnen); de UI vertaalt via `defects.symptoms.<key>`. */
  label: string;
  icon: string;
  /** Machinetypes waarvoor dit symptoom relevant is; null = alle typen. */
  machineTypes: readonly MachineType[] | null;
};

export const DEFECT_SYMPTOMS: readonly DefectSymptom[] = [
  { key: "noise", label: "Maakt raar geluid", icon: "🔊", machineTypes: null },
  { key: "pin", label: "Pin of gewichtspen kapot of kwijt", icon: "📍", machineTypes: ["KRACHT"] },
  { key: "cable", label: "Kabel of riem beschadigd", icon: "🪢", machineTypes: ["KRACHT", "CARDIO"] },
  { key: "stuck", label: "Zit vast of loopt stroef", icon: "🛑", machineTypes: null },
  { key: "electronics", label: "Scherm of elektronica doet het niet", icon: "🖥️", machineTypes: ["CARDIO", "OVERIG"] },
  { key: "loose", label: "Onderdeel los of ontbreekt", icon: "🔩", machineTypes: null },
  { key: "upholstery", label: "Zitting of bekleding beschadigd", icon: "🪑", machineTypes: ["KRACHT", "VRIJE_GEWICHTEN", "OVERIG"] },
  { key: "other", label: "Anders", icon: "❓", machineTypes: null },
] as const;

export const DEFECT_SYMPTOM_KEYS = DEFECT_SYMPTOMS.map((s) => s.key) as [
  DefectSymptomKey,
  ...DefectSymptomKey[],
];

export function isDefectSymptomKey(key: string): key is DefectSymptomKey {
  return DEFECT_SYMPTOMS.some((s) => s.key === key);
}

export function defectSymptomLabel(key: string): string {
  return DEFECT_SYMPTOMS.find((s) => s.key === key)?.label ?? key;
}

/**
 * Symptomen die passen bij een machinetype. Zonder type (apparaat niet in de
 * lijst / onbekend) tonen we de volledige lijst.
 */
export function symptomsForMachineType(
  type: MachineType | null | undefined
): readonly DefectSymptom[] {
  if (!type) return DEFECT_SYMPTOMS;
  return DEFECT_SYMPTOMS.filter((s) => s.machineTypes === null || s.machineTypes.includes(type));
}

// --- Status & severity ---------------------------------------------------------

export const DEFECT_STATUS_META: Record<
  DefectStatus,
  { label: string; tone: BadgeTone; icon: string }
> = {
  OPEN: { label: "Open", tone: "danger", icon: "🔴" },
  ACKNOWLEDGED: { label: "Gezien", tone: "warning", icon: "👀" },
  IN_REPAIR: { label: "In reparatie", tone: "accent", icon: "🔧" },
  RESOLVED: { label: "Opgelost", tone: "success", icon: "✅" },
  REJECTED: { label: "Afgewezen", tone: "neutral", icon: "🚫" },
};

export const DEFECT_SEVERITY_META: Record<
  DefectSeverity,
  { label: string; tone: BadgeTone; icon: string; rank: number }
> = {
  MINOR: { label: "Klein", tone: "neutral", icon: "🟡", rank: 0 },
  MAJOR: { label: "Niet bruikbaar", tone: "warning", icon: "🟠", rank: 1 },
  UNSAFE: { label: "Gevaarlijk", tone: "danger", icon: "⛔", rank: 2 },
};

export const DEFECT_STATUSES = [
  "OPEN",
  "ACKNOWLEDGED",
  "IN_REPAIR",
  "RESOLVED",
  "REJECTED",
] as const satisfies readonly DefectStatus[];

export const DEFECT_SEVERITIES = ["MINOR", "MAJOR", "UNSAFE"] as const satisfies
  readonly DefectSeverity[];

/** Statussen die als "open" tellen (dashboard-default, achterstand, duplicaatcheck). */
export const OPEN_DEFECT_STATUSES = [
  "OPEN",
  "ACKNOWLEDGED",
  "IN_REPAIR",
] as const satisfies readonly DefectStatus[];

export function isOpenDefectStatus(status: DefectStatus): boolean {
  return (OPEN_DEFECT_STATUSES as readonly DefectStatus[]).includes(status);
}

// --- Bevestigingen ("ik zie dit ook") ------------------------------------------

/** Vanaf dit aantal bevestigingen gaat de severity automatisch één stap omhoog. */
export const CONFIRM_BUMP_THRESHOLD = 3;

/**
 * Eén stap omhoog in ernst, maar NOOIT automatisch naar UNSAFE
 * (acceptatiecriterium 4) — "gevaarlijk" vereist een expliciete melding.
 */
export function bumpSeverity(current: DefectSeverity): DefectSeverity {
  return current === "MINOR" ? "MAJOR" : current;
}

// --- Daglimiet meldingen --------------------------------------------------------

/** Maximaal aantal defectmeldingen per lid per kalenderdag. */
export const DEFECT_DAILY_LIMIT = 10;

/** Maximaal aantal foto's per melding. */
export const DEFECT_MAX_PHOTOS = 2;

// --- Leeftijd & achterstand ----------------------------------------------------

const DAY_MS = 86_400_000;

/** Hele dagen sinds de melding (afgerond naar beneden). */
export function defectAgeDays(createdAt: Date | string, now: Date = new Date()): number {
  const created = createdAt instanceof Date ? createdAt : new Date(createdAt);
  return Math.max(0, Math.floor((now.getTime() - created.getTime()) / DAY_MS));
}

/** Compact NL-leeftijdslabel ("vandaag", "3 d", "2 wkn"). */
export function defectAgeLabel(createdAt: Date | string, now: Date = new Date()): string {
  const days = defectAgeDays(createdAt, now);
  if (days === 0) return "vandaag";
  if (days < 14) return `${days} d`;
  return `${Math.floor(days / 7)} wkn`;
}

/**
 * Is deze melding achterstand voor de dagelijkse samenvatting? Open (niet
 * opgelost/afgewezen) en ouder dan de tenant-termijn (`defectReminderDays`).
 */
export function isOverdueDefect(
  defect: { status: DefectStatus; createdAt: Date | string },
  reminderDays: number,
  now: Date = new Date()
): boolean {
  if (!isOpenDefectStatus(defect.status)) return false;
  return defectAgeDays(defect.createdAt, now) >= Math.max(1, reminderDays);
}
