import "server-only";
import type { MachineStatus, MachineType, MaintenanceKind } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  computeMaintenanceState,
  effectiveStatus,
  type MaintenanceLevel,
} from "@/lib/maintenance";

// Base `prisma` + expliciete tenantId (zoals lib/member-stats.ts) — RLS is de
// backstop. Alle waarden worden server-side geserialiseerd (datums → ISO,
// Decimal → number) zodat client-componenten ze direct kunnen renderen.

export type MaintenanceMachineRow = {
  id: string;
  name: string;
  type: MachineType;
  location: string | null;
  serialNumber: string | null;
  purchaseDate: string | null;
  imageUrl: string | null;
  status: MachineStatus; // opgeslagen status
  effectiveStatus: MachineStatus; // gecombineerd met het afgeleide niveau
  usageCount: number;
  usageThreshold: number | null;
  maintenanceIntervalDays: number | null;
  lastMaintenanceAt: string | null;
  nextMaintenanceAt: string | null;
  level: MaintenanceLevel;
  usageRatio: number | null;
  usageRemaining: number | null;
  daysUntilDue: number | null;
  reasons: string[];
};

export type MaintenanceRecordRow = {
  id: string;
  machineId: string;
  machineName: string;
  kind: MaintenanceKind;
  performedAt: string;
  action: string;
  note: string | null;
  performedBy: string | null;
  cost: number | null;
  usageAtService: number;
  nextMaintenanceAt: string | null;
};

export type MaintenanceOverview = {
  machines: MaintenanceMachineRow[];
  records: MaintenanceRecordRow[];
  counts: { due: number; soon: number; inMaintenance: number; outOfService: number; active: number };
};

const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);

/**
 * Volledig overzicht voor het onderhoudsdashboard. Draait eerst de lazy
 * auto-evaluatie (status-transities) en levert daarna geserialiseerde rijen +
 * samenvattingstellers.
 */
export async function getMaintenanceOverview(
  tenantId: string
): Promise<MaintenanceOverview> {
  const now = new Date();
  const [machines, records] = await Promise.all([
    prisma.machine.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        type: true,
        location: true,
        serialNumber: true,
        purchaseDate: true,
        imageUrl: true,
        status: true,
        usageCount: true,
        usageThreshold: true,
        maintenanceIntervalDays: true,
        lastMaintenanceAt: true,
        nextMaintenanceAt: true,
      },
    }),
    prisma.maintenanceRecord.findMany({
      where: { tenantId },
      orderBy: { performedAt: "desc" },
      take: 100,
      select: {
        id: true,
        machineId: true,
        kind: true,
        performedAt: true,
        action: true,
        note: true,
        performedByName: true,
        cost: true,
        usageAtService: true,
        nextMaintenanceAt: true,
        machine: { select: { name: true } },
        performedBy: { select: { name: true, email: true } },
      },
    }),
  ]);

  const counts = { due: 0, soon: 0, inMaintenance: 0, outOfService: 0, active: 0 };
  // Afgeleide auto-status-transities (ACTIVE↔MAINTENANCE_DUE) verzamelen uit de
  // machines die we hier tóch al ophalen — voorheen deed evaluateDueMachines dit
  // met een tweede volledige machine-scan bij élke dashboard-load. Handmatige
  // statussen (IN_MAINTENANCE/OUT_OF_SERVICE) blijven ongemoeid.
  const toDue: string[] = [];
  const toActive: string[] = [];

  const machineRows: MaintenanceMachineRow[] = machines.map((m) => {
    const state = computeMaintenanceState(m, now);
    const eff = effectiveStatus(m.status, state);
    if (state.level === "due" && m.status === "ACTIVE") toDue.push(m.id);
    else if (state.level !== "due" && m.status === "MAINTENANCE_DUE") toActive.push(m.id);
    if (eff === "OUT_OF_SERVICE") counts.outOfService += 1;
    else if (eff === "IN_MAINTENANCE") counts.inMaintenance += 1;
    else if (eff === "MAINTENANCE_DUE") counts.due += 1;
    else if (state.level === "soon") counts.soon += 1;
    else counts.active += 1;

    return {
      id: m.id,
      name: m.name,
      type: m.type,
      location: m.location,
      serialNumber: m.serialNumber,
      purchaseDate: iso(m.purchaseDate),
      imageUrl: m.imageUrl,
      status: m.status,
      effectiveStatus: eff,
      usageCount: m.usageCount,
      usageThreshold: m.usageThreshold,
      maintenanceIntervalDays: m.maintenanceIntervalDays,
      lastMaintenanceAt: iso(m.lastMaintenanceAt),
      nextMaintenanceAt: iso(m.nextMaintenanceAt),
      level: state.level,
      usageRatio: state.usageRatio,
      usageRemaining: state.usageRemaining,
      daysUntilDue: state.daysUntilDue,
      reasons: state.reasons,
    };
  });

  // Persisteer de transities in max. twee batches (i.p.v. een losse update per
  // machine). Best-effort: de weergave hierboven gebruikt toch effectiveStatus,
  // dus dit synchroniseert enkel de opgeslagen status voor andere views + de cron.
  if (toDue.length > 0) {
    await prisma.machine
      .updateMany({ where: { id: { in: toDue }, tenantId }, data: { status: "MAINTENANCE_DUE" } })
      .catch(() => {});
  }
  if (toActive.length > 0) {
    await prisma.machine
      .updateMany({ where: { id: { in: toActive }, tenantId }, data: { status: "ACTIVE" } })
      .catch(() => {});
  }

  const recordRows: MaintenanceRecordRow[] = records.map((r) => ({
    id: r.id,
    machineId: r.machineId,
    machineName: r.machine?.name ?? "—",
    kind: r.kind,
    performedAt: r.performedAt.toISOString(),
    action: r.action,
    note: r.note,
    performedBy: r.performedByName ?? r.performedBy?.name ?? r.performedBy?.email ?? null,
    cost: r.cost != null ? Number(r.cost) : null,
    usageAtService: r.usageAtService,
    nextMaintenanceAt: iso(r.nextMaintenanceAt),
  }));

  return { machines: machineRows, records: recordRows, counts };
}

/** Lichte teller voor de dashboard-alert (aantal machines dat aandacht vraagt). */
export async function getMaintenanceAttentionCount(tenantId: string): Promise<number> {
  const now = new Date();
  const machines = await prisma.machine.findMany({
    where: { tenantId },
    select: {
      status: true,
      usageCount: true,
      usageThreshold: true,
      maintenanceIntervalDays: true,
      nextMaintenanceAt: true,
    },
  });
  let count = 0;
  for (const m of machines) {
    const state = computeMaintenanceState(m, now);
    const eff = effectiveStatus(m.status, state);
    if (eff === "MAINTENANCE_DUE" || eff === "OUT_OF_SERVICE" || state.level === "soon") {
      count += 1;
    }
  }
  return count;
}

/**
 * Auto-evaluatie: transitioneer ACTIVE↔MAINTENANCE_DUE op basis van de gebruik-/
 * tijddrempels. Handmatige statussen (IN_MAINTENANCE/OUT_OF_SERVICE) blijven
 * ongemoeid. Levert de machine-ids die een melding verdienen (nog niet gemeld):
 *   - `due`  : drempel bereikt/overschreden
 *   - `soon` : nadert de drempel (binnenkort onderhoud nodig)
 * De melding-markers worden pas gezet door lib/maintenance/notify.ts (idempotent).
 */
export async function evaluateDueMachines(
  tenantId: string,
  now: Date = new Date()
): Promise<{ due: string[]; soon: string[] }> {
  const machines = await prisma.machine.findMany({
    where: { tenantId, status: { in: ["ACTIVE", "MAINTENANCE_DUE"] } },
    select: {
      id: true,
      status: true,
      usageCount: true,
      usageThreshold: true,
      maintenanceIntervalDays: true,
      nextMaintenanceAt: true,
      maintenanceDueNotifiedAt: true,
      maintenanceWarnNotifiedAt: true,
    },
  });

  const due: string[] = [];
  const soon: string[] = [];

  for (const m of machines) {
    const state = computeMaintenanceState(m, now);

    if (state.level === "due") {
      if (m.status !== "MAINTENANCE_DUE") {
        await prisma.machine
          .update({ where: { id: m.id }, data: { status: "MAINTENANCE_DUE" } })
          .catch(() => {});
      }
      if (m.maintenanceDueNotifiedAt == null) due.push(m.id);
    } else {
      // Zelf-herstel: drempel opgehoogd of onderhoud gedaan → terug naar actief.
      if (m.status === "MAINTENANCE_DUE") {
        await prisma.machine
          .update({ where: { id: m.id }, data: { status: "ACTIVE" } })
          .catch(() => {});
      }
      if (state.level === "soon" && m.maintenanceWarnNotifiedAt == null) soon.push(m.id);
    }
  }

  return { due, soon };
}

/**
 * Registreer gebruik: elke afgeronde sessie telt +1 per gebruikte machine
 * (via oefening → machineId). Best-effort — mag het afronden nooit breken.
 * @returns de machine-ids waarvan de teller is opgehoogd.
 */
export async function recordMachineUsageForSession(
  sessionId: string,
  tenantId: string
): Promise<string[]> {
  try {
    const entries = await prisma.performanceEntry.findMany({
      where: { sessionId, tenantId },
      select: { exercise: { select: { machineId: true } } },
    });
    const machineIds = [
      ...new Set(
        entries
          .map((e) => e.exercise?.machineId)
          .filter((id): id is string => Boolean(id))
      ),
    ];
    if (machineIds.length === 0) return [];

    await prisma.machine.updateMany({
      where: { id: { in: machineIds }, tenantId },
      data: { usageCount: { increment: 1 } },
    });
    return machineIds;
  } catch (err) {
    console.error("[maintenance] gebruik registreren mislukt:", (err as Error).message);
    return [];
  }
}
