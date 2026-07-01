// Pure onderhouds-helpers (geen Prisma/server-only import) zodat dit ook in
// Client Components veilig te gebruiken is — idioom van lib/exercise-types.ts /
// lib/schema-status.ts. Eén bron van waarheid voor labels, kleuren, drempels en
// de afgeleide onderhoudsstatus van een machine.
import type { MachineStatus, MaintenanceKind } from "@prisma/client";
import type { BadgeTone } from "@/components/ui/badge";

// --- Statussen ---------------------------------------------------------------

export const MACHINE_STATUS_META: Record<
  MachineStatus,
  { label: string; tone: BadgeTone; icon: string }
> = {
  ACTIVE: { label: "Actief", tone: "success", icon: "✅" },
  MAINTENANCE_DUE: { label: "Onderhoud nodig", tone: "danger", icon: "🔧" },
  IN_MAINTENANCE: { label: "In onderhoud", tone: "warning", icon: "🛠️" },
  OUT_OF_SERVICE: { label: "Buiten gebruik", tone: "neutral", icon: "⛔" },
};

export const MACHINE_STATUSES = [
  "ACTIVE",
  "MAINTENANCE_DUE",
  "IN_MAINTENANCE",
  "OUT_OF_SERVICE",
] as const satisfies readonly MachineStatus[];

export function machineStatusLabel(status: MachineStatus): string {
  return MACHINE_STATUS_META[status]?.label ?? status;
}

// --- Soort onderhoud ---------------------------------------------------------

export const MAINTENANCE_KIND_META: Record<
  MaintenanceKind,
  { label: string; icon: string }
> = {
  SERVICE: { label: "Onderhoud", icon: "🔧" },
  INSPECTION: { label: "Inspectie", icon: "🔍" },
  SAFETY_CHECK: { label: "Veiligheidscheck", icon: "🛡️" },
  REPAIR: { label: "Reparatie", icon: "🩹" },
};

export const MAINTENANCE_KINDS = [
  "SERVICE",
  "INSPECTION",
  "SAFETY_CHECK",
  "REPAIR",
] as const satisfies readonly MaintenanceKind[];

export function maintenanceKindLabel(kind: MaintenanceKind): string {
  return MAINTENANCE_KIND_META[kind]?.label ?? kind;
}

// --- Interval-presets --------------------------------------------------------

export const INTERVAL_PRESETS: { label: string; days: number }[] = [
  { label: "Maandelijks", days: 30 },
  { label: "Elke 3 maanden", days: 90 },
  { label: "Elke 6 maanden", days: 180 },
  { label: "Jaarlijks", days: 365 },
];

export const USAGE_PRESETS = [100, 250, 500, 1000];

/** Binnen hoeveel dagen voor de volgende datum we "binnenkort" tonen. */
export const MAINTENANCE_SOON_WITHIN_DAYS = 14;
/** Vanaf welke gebruiksverhouding (t.o.v. de drempel) we "binnenkort" tonen. */
export const MAINTENANCE_SOON_USAGE_RATIO = 0.8;

const DAY_MS = 86_400_000;

// --- Afgeleide onderhoudsstatus ----------------------------------------------

/** Ernst-niveau afgeleid uit de gebruik-/tijddrempels (los van de opgeslagen status). */
export type MaintenanceLevel = "ok" | "soon" | "due";

export type MaintenanceMachine = {
  usageCount: number;
  usageThreshold: number | null;
  maintenanceIntervalDays: number | null;
  nextMaintenanceAt: Date | string | null;
};

export type MaintenanceState = {
  level: MaintenanceLevel;
  /** Gebruiksverhouding 0..1 (of null als er geen gebruikslimiet is). */
  usageRatio: number | null;
  /** Resterend aantal keren gebruik tot de drempel (null = geen limiet). */
  usageRemaining: number | null;
  /** Dagen tot de volgende onderhoudsdatum (negatief = verstreken; null = geen). */
  daysUntilDue: number | null;
  byUsage: MaintenanceLevel;
  byTime: MaintenanceLevel;
  /** Leesbare redenen ("500/500 gebruiksbeurten", "3 dagen te laat"). */
  reasons: string[];
};

function toDate(v: Date | string | null): Date | null {
  if (!v) return null;
  return v instanceof Date ? v : new Date(v);
}

/**
 * Bereken het afgeleide onderhoudsniveau van een machine uit de gebruik- én
 * tijddrempels. Het zwaarste van beide wint. Puur — geen DB, geen status-mutatie.
 */
export function computeMaintenanceState(
  machine: MaintenanceMachine,
  now: Date = new Date()
): MaintenanceState {
  const reasons: string[] = [];

  // Gebruik-trigger
  let usageRatio: number | null = null;
  let usageRemaining: number | null = null;
  let byUsage: MaintenanceLevel = "ok";
  if (machine.usageThreshold && machine.usageThreshold > 0) {
    usageRatio = machine.usageCount / machine.usageThreshold;
    usageRemaining = Math.max(0, machine.usageThreshold - machine.usageCount);
    if (machine.usageCount >= machine.usageThreshold) {
      byUsage = "due";
      reasons.push(`${machine.usageCount}/${machine.usageThreshold} gebruiksbeurten`);
    } else if (usageRatio >= MAINTENANCE_SOON_USAGE_RATIO) {
      byUsage = "soon";
      reasons.push(`Nog ${usageRemaining} gebruiksbeurten tot onderhoud`);
    }
  }

  // Tijd-trigger
  let daysUntilDue: number | null = null;
  let byTime: MaintenanceLevel = "ok";
  const next = toDate(machine.nextMaintenanceAt);
  if (next) {
    daysUntilDue = Math.ceil((next.getTime() - now.getTime()) / DAY_MS);
    if (daysUntilDue <= 0) {
      byTime = "due";
      reasons.push(
        daysUntilDue === 0
          ? "Onderhoud is vandaag gepland"
          : `${Math.abs(daysUntilDue)} dagen te laat`
      );
    } else if (daysUntilDue <= MAINTENANCE_SOON_WITHIN_DAYS) {
      byTime = "soon";
      reasons.push(`Onderhoud over ${daysUntilDue} dagen`);
    }
  }

  const rank: Record<MaintenanceLevel, number> = { ok: 0, soon: 1, due: 2 };
  const level = rank[byUsage] >= rank[byTime] ? byUsage : byTime;

  return { level, usageRatio, usageRemaining, daysUntilDue, byUsage, byTime, reasons };
}

/**
 * De weer te geven status: combineert de opgeslagen status met het afgeleide
 * niveau. Handmatige statussen (in onderhoud / buiten gebruik) blijven leidend;
 * een ACTIVE-machine die over de drempel is, toont "Onderhoud nodig".
 */
export function effectiveStatus(
  storedStatus: MachineStatus,
  state: MaintenanceState
): MachineStatus {
  if (storedStatus === "IN_MAINTENANCE" || storedStatus === "OUT_OF_SERVICE") {
    return storedStatus;
  }
  return state.level === "due" ? "MAINTENANCE_DUE" : "ACTIVE";
}

/** Volgende onderhoudsdatum vanaf een basisdatum + interval in dagen. */
export function computeNextMaintenance(
  from: Date,
  intervalDays: number | null | undefined
): Date | null {
  if (!intervalDays || intervalDays <= 0) return null;
  return new Date(from.getTime() + intervalDays * DAY_MS);
}

// --- Formatters --------------------------------------------------------------

export function fmtDate(v: Date | string | null | undefined): string {
  const d = toDate(v ?? null);
  if (!d) return "—";
  return d.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function fmtCost(v: number | null | undefined): string {
  if (v == null) return "—";
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(v);
}
