import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/staff";
import { machineTypeLabel } from "@/lib/machine";
import { computeMaintenanceState, effectiveStatus } from "@/lib/maintenance";
import { isFeatureEnabled } from "@/lib/features/service";
import { getScanOverview } from "@/lib/machine-scans";
import { MachinesTable, type MachineRow } from "./machines-table";

export async function generateMetadata() {
  const t = await getTranslations("owner.machines");
  return { title: t("metaTitle") };
}

export default async function MachinesPage() {
  // Gedeelde toegang: eigenaar (passeert altijd) of medewerker met QR-export.
  // Machine-CRUD blijft admin-only (zie `canManage`); staff krijgt een read-only
  // lijst met de bulk-export-functie.
  const user = await requirePermission("machines:qr-export");
  const canManage = user.role === "TENANT_ADMIN";
  const t = await getTranslations("owner.machines");
  const maintenanceEnabled = await isFeatureEnabled(user.tenantId, "maintenance");

  // Oplopend op aanmaakdatum → stabiele nummering ("Nr. X") die tussen exports
  // gelijk blijft en overeenkomt met de PDF/ZIP-serverkant.
  const machines = await prisma.machine.findMany({
    where: { tenantId: user.tenantId },
    orderBy: [{ createdAt: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      type: true,
      imageUrl: true,
      qrToken: true,
      status: true,
      location: true,
      serialNumber: true,
      usageCount: true,
      usageThreshold: true,
      maintenanceIntervalDays: true,
      nextMaintenanceAt: true,
    },
  });

  const scans = await getScanOverview(user.tenantId);

  const rows: MachineRow[] = machines.map((m, i) => {
    const state = computeMaintenanceState(m);
    const scan = scans.get(m.id);
    return {
      id: m.id,
      number: i + 1,
      name: m.name,
      type: m.type,
      category: machineTypeLabel(m.type),
      imageUrl: m.imageUrl,
      hasQr: Boolean(m.qrToken),
      location: m.location,
      serialNumber: m.serialNumber,
      status: effectiveStatus(m.status, state),
      level: state.level,
      scanCount: scan?.scanCount ?? 0,
      scansThisWeek: scan?.scansThisWeek ?? 0,
    };
  });

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
            {t("title")}
          </h1>
          <p className="text-sm text-neutral-500">
            {t("count", { count: machines.length })}
          </p>
        </div>
        {canManage ? (
          <Link
            href="/owner/machines/new"
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground hover:opacity-90"
          >
            {t("newMachine")}
          </Link>
        ) : null}
      </div>

      <MachinesTable
        machines={rows}
        showStatus={maintenanceEnabled}
        canManage={canManage}
        exportEndpoint="/owner/machines/qr-export"
      />
    </div>
  );
}
