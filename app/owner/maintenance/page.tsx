import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/staff";
import { getMaintenanceOverview } from "@/lib/maintenance-eval";
import { MaintenanceDashboard } from "@/components/maintenance/maintenance-dashboard";
import { PolicyEditor, type PolicyRow } from "@/components/maintenance/policy-editor";

export const metadata = { title: "Onderhoud" };

export default async function MaintenancePage() {
  const user = await requirePermission("maintenance:manage");
  const isAdmin = user.role === "TENANT_ADMIN";

  const [overview, policies] = await Promise.all([
    getMaintenanceOverview(user.tenantId),
    prisma.maintenancePolicy.findMany({
      where: { tenantId: user.tenantId },
      select: { machineType: true, usageThreshold: true, intervalDays: true },
    }),
  ]);

  const policyRows: PolicyRow[] = policies.map((p) => ({
    machineType: p.machineType,
    usageThreshold: p.usageThreshold,
    intervalDays: p.intervalDays,
  }));

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Onderhoud</h1>
          <p className="text-sm text-neutral-500">
            Houd je apparatuur veilig en op tijd onderhouden — automatisch gesignaleerd op
            gebruik en tijd.
          </p>
        </div>
        <Link
          href="/owner/machines"
          className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
        >
          Machines beheren
        </Link>
      </div>

      {overview.machines.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-neutral-500">
          Er zijn nog geen machines. Voeg eerst apparatuur toe via{" "}
          <Link href="/owner/machines" className="text-accent underline">
            Machines
          </Link>
          .
        </p>
      ) : (
        <MaintenanceDashboard
          machines={overview.machines}
          records={overview.records}
          counts={overview.counts}
        />
      )}

      {isAdmin ? <PolicyEditor policies={policyRows} /> : null}
    </div>
  );
}
