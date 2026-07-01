import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant";
import { requireOwner } from "@/lib/owner";
import { blobConfigured } from "@/lib/blob";
import { machinePublicUrl } from "@/lib/machine";
import { MachineForm } from "../machine-form";
import { deleteMachine } from "../actions";
import { DownloadQrButton } from "@/components/ui/download-qr-button";
import { computeMaintenanceState, effectiveStatus } from "@/lib/maintenance";
import { MachineMaintenancePanel } from "@/components/maintenance/machine-maintenance-panel";
import { isFeatureEnabled } from "@/lib/features/service";
import type { MaintenanceRecordRow } from "@/lib/maintenance-eval";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const tenant = await getCurrentTenant();
  const machine = tenant
    ? await prisma.machine.findFirst({
        where: { id, tenantId: tenant.id },
        select: { name: true },
      })
    : null;
  return { title: machine ? `${machine.name} | Apparaat` : "Apparaat" };
}

export default async function MachineDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const owner = await requireOwner();

  const machine = await prisma.machine.findFirst({
    where: { id, tenantId: owner.tenantId },
  });
  if (!machine) notFound();

  const tenant = await prisma.tenant.findUnique({
    where: { id: owner.tenantId },
    select: { slug: true },
  });
  const publicUrl = machinePublicUrl(tenant?.slug ?? "", machine.qrToken);

  // Onderhoudsmodule uit (Superadmin-flag) → geen onderhoudspaneel/historie.
  const maintenanceEnabled = await isFeatureEnabled(owner.tenantId, "maintenance");

  const maintenanceRecords = maintenanceEnabled
    ? await prisma.maintenanceRecord.findMany({
    where: { machineId: machine.id, tenantId: owner.tenantId },
    orderBy: { performedAt: "desc" },
    take: 20,
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
      performedBy: { select: { name: true, email: true } },
    },
      })
    : [];
  const recordRows: MaintenanceRecordRow[] = maintenanceRecords.map((r) => ({
    id: r.id,
    machineId: r.machineId,
    machineName: machine.name,
    kind: r.kind,
    performedAt: r.performedAt.toISOString(),
    action: r.action,
    note: r.note,
    performedBy: r.performedByName ?? r.performedBy?.name ?? r.performedBy?.email ?? null,
    cost: r.cost != null ? Number(r.cost) : null,
    usageAtService: r.usageAtService,
    nextMaintenanceAt: r.nextMaintenanceAt ? r.nextMaintenanceAt.toISOString() : null,
  }));

  const state = computeMaintenanceState(machine);
  const eff = effectiveStatus(machine.status, state);

  return (
    <div className="flex flex-col gap-8 px-4 py-6 sm:px-6 sm:py-8">
      <div>
        <Link
          href="/owner/machines"
          className="text-sm text-neutral-500 hover:text-neutral-900"
        >
          ← Machines
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900">
          {machine.name}
        </h1>
      </div>

      <MachineForm
        blobEnabled={blobConfigured()}
        machine={{
          id: machine.id,
          name: machine.name,
          type: machine.type,
          description: machine.description,
          instructionsMd: machine.instructionsMd,
          videoUrl: machine.videoUrl,
          imageUrl: machine.imageUrl,
          location: machine.location,
          serialNumber: machine.serialNumber,
          purchaseDate: machine.purchaseDate
            ? machine.purchaseDate.toISOString().slice(0, 10)
            : null,
        }}
      />

      {maintenanceEnabled ? (
        <MachineMaintenancePanel
          machine={{
            id: machine.id,
            name: machine.name,
            status: machine.status,
            effectiveStatus: eff,
            level: state.level,
            usageCount: machine.usageCount,
            usageThreshold: machine.usageThreshold,
            maintenanceIntervalDays: machine.maintenanceIntervalDays,
            lastMaintenanceAt: machine.lastMaintenanceAt
              ? machine.lastMaintenanceAt.toISOString()
              : null,
            nextMaintenanceAt: machine.nextMaintenanceAt
              ? machine.nextMaintenanceAt.toISOString()
              : null,
            daysUntilDue: state.daysUntilDue,
            usageRatio: state.usageRatio,
            reasons: state.reasons,
          }}
          records={recordRows}
        />
      ) : null}

      <section className="flex max-w-2xl flex-col gap-3 rounded-xl border border-neutral-200 p-5">
        <h2 className="text-sm font-semibold text-neutral-900">QR-code</h2>
        <p className="break-all text-xs text-neutral-500">{publicUrl}</p>
        <div>
          <DownloadQrButton
            url={publicUrl}
            filename={`qr-${machine.name.toLowerCase().replace(/\s+/g, "-")}`}
          />
        </div>
      </section>

      <section className="flex max-w-2xl flex-col gap-3 rounded-xl border border-red-200 p-5">
        <h2 className="text-sm font-semibold text-red-700">Verwijderen</h2>
        <p className="text-sm text-neutral-500">
          Dit verwijdert de machine permanent.
        </p>
        <form action={deleteMachine}>
          <input type="hidden" name="id" value={machine.id} />
          <button
            type="submit"
            className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50"
          >
            Machine verwijderen
          </button>
        </form>
      </section>
    </div>
  );
}
