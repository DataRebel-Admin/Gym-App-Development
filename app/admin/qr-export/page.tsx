import { prisma } from "@/lib/db";
import { requireSuperadmin } from "@/lib/superadmin";
import { machineTypeLabel } from "@/lib/machine";
import { AdminQrExport, type AdminMachineRow } from "@/components/qr-export/admin-qr-export";

export const metadata = { title: "QR-codes exporteren" };

export default async function AdminQrExportPage({
  searchParams,
}: {
  searchParams: Promise<{ tenantId?: string }>;
}) {
  await requireSuperadmin();
  const { tenantId } = await searchParams;
  const selectedTenantId = tenantId ?? "";

  const tenants = await prisma.tenant.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true, _count: { select: { machines: true } } },
  });
  const tenantOptions = tenants.map((t) => ({
    id: t.id,
    name: t.name,
    machineCount: t._count.machines,
  }));

  let machines: AdminMachineRow[] = [];
  if (selectedTenantId && selectedTenantId !== "all") {
    // Oplopend op createdAt → stabiele nummering (gelijk aan de serverkant).
    const rows = await prisma.machine.findMany({
      where: { tenantId: selectedTenantId },
      orderBy: [{ createdAt: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        location: true,
        serialNumber: true,
      },
    });
    machines = rows.map((m, i) => ({
      id: m.id,
      number: i + 1,
      name: m.name,
      type: m.type,
      category: machineTypeLabel(m.type),
      status: m.status,
      location: m.location,
      serialNumber: m.serialNumber,
    }));
  }

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
          QR-codes exporteren
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Download printbare QR-codes van apparaten per sportschool of gebundeld voor alle sportscholen.
        </p>
      </div>

      <AdminQrExport
        tenants={tenantOptions}
        selectedTenantId={selectedTenantId}
        machines={machines}
      />
    </div>
  );
}
