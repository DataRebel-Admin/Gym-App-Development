import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";

/**
 * Read-only aggregaties voor QR-scan-tracking. De teller (`scanCount`) +
 * `lastScannedAt` staan gedenormaliseerd op `Machine`; de trends komen uit het
 * `MachineScan`-logmodel. Tenant-scoped via expliciete `tenantId` (zoals
 * lib/member-stats.ts) met RLS als backstop.
 */

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export type MachineScanStats = {
  machineId: string;
  scanCount: number;
  lastScannedAt: string | null;
  scansThisWeek: number;
};

/**
 * Per-machine scan-samenvatting (totaal + laatste + laatste 7 dagen) voor de
 * machinelijst. Eén query op Machine + één groupBy op MachineScan.
 */
export async function getScanOverview(tenantId: string): Promise<Map<string, MachineScanStats>> {
  const since = new Date(Date.now() - WEEK_MS);

  const [machines, weekGroups] = await Promise.all([
    prisma.machine.findMany({
      where: { tenantId },
      select: { id: true, scanCount: true, lastScannedAt: true },
    }),
    prisma.machineScan.groupBy({
      by: ["machineId"],
      where: { tenantId, scannedAt: { gte: since } },
      _count: { _all: true },
    }),
  ]);

  const weekMap = new Map(weekGroups.map((g) => [g.machineId, g._count._all]));

  const out = new Map<string, MachineScanStats>();
  for (const m of machines) {
    out.set(m.id, {
      machineId: m.id,
      scanCount: m.scanCount,
      lastScannedAt: m.lastScannedAt ? m.lastScannedAt.toISOString() : null,
      scansThisWeek: weekMap.get(m.id) ?? 0,
    });
  }
  return out;
}

export type ScanTrendPoint = { weekStart: string; label: string; count: number };

/** Maandag 00:00 van de week waarin `d` valt (lokale tijd). */
function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = (x.getDay() + 6) % 7; // ma=0 … zo=6
  x.setDate(x.getDate() - day);
  return x;
}

/**
 * Wekelijkse scan-buckets voor de mini-grafiek op het machine-detail. Levert
 * altijd `weeks` opeenvolgende weken (ook lege), oud → nieuw. Gecachet per
 * (tenant, machine, weken) met 5-min revalidatie — een weekgebucketde trend,
 * dus staleness is onmerkbaar (idioom lib/insights.ts).
 */
export function getMachineScanTrend(
  tenantId: string,
  machineId: string,
  weeks = 12,
): Promise<ScanTrendPoint[]> {
  return unstable_cache(
    () => computeMachineScanTrend(tenantId, machineId, weeks),
    ["machine-scan-trend", tenantId, machineId, String(weeks)],
    { revalidate: 300 }
  )();
}

async function computeMachineScanTrend(
  tenantId: string,
  machineId: string,
  weeks: number,
): Promise<ScanTrendPoint[]> {
  const thisWeek = startOfWeek(new Date());
  const from = new Date(thisWeek.getTime() - (weeks - 1) * WEEK_MS);

  const scans = await prisma.machineScan.findMany({
    where: { tenantId, machineId, scannedAt: { gte: from } },
    select: { scannedAt: true },
  });

  // Lege buckets voorbereiden (stabiele volgorde oud → nieuw).
  const buckets: ScanTrendPoint[] = [];
  const index = new Map<number, number>();
  for (let i = 0; i < weeks; i++) {
    const ws = new Date(from.getTime() + i * WEEK_MS);
    index.set(ws.getTime(), i);
    buckets.push({
      weekStart: ws.toISOString(),
      label: `${ws.getDate()}/${ws.getMonth() + 1}`,
      count: 0,
    });
  }

  for (const s of scans) {
    const ws = startOfWeek(s.scannedAt).getTime();
    const i = index.get(ws);
    if (i != null) buckets[i].count += 1;
  }
  return buckets;
}
