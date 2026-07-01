import { requireSuperadmin } from "@/lib/superadmin";
import { prisma } from "@/lib/db";
import { getFeatureFlagRows } from "@/lib/features/service";
import { EmptyState } from "@/components/ui/empty-state";
import { FeatureTenantPicker } from "@/components/admin/feature-tenant-picker";
import { FeatureFlagsManager } from "@/components/admin/feature-flags-manager";

export const metadata = { title: "Feature Management" };

export default async function AdminFeaturesPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string }>;
}) {
  await requireSuperadmin();
  const { tenant: tenantParam } = await searchParams;

  const tenants = await prisma.tenant.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, slug: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
          Feature Management
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Bepaal per sportschool welke modules beschikbaar zijn. Wijzigingen zijn
          direct actief; bestaande gegevens blijven altijd behouden.
        </p>
      </div>

      {tenants.length === 0 ? (
        <EmptyState
          title="Geen sportscholen"
          description="Er zijn nog geen actieve sportscholen om features voor te beheren."
        />
      ) : (
        (() => {
          const selected =
            tenants.find((t) => t.id === tenantParam) ?? tenants[0];
          return (
            <div className="flex max-w-3xl flex-col gap-5">
              <FeatureTenantPicker tenants={tenants} current={selected.id} />
              {/* rows opnieuw ophalen bij tenant-wissel gebeurt server-side */}
              <FeatureRows tenantId={selected.id} />
            </div>
          );
        })()
      )}
    </div>
  );
}

async function FeatureRows({ tenantId }: { tenantId: string }) {
  const rows = await getFeatureFlagRows(tenantId);
  return <FeatureFlagsManager tenantId={tenantId} rows={rows} />;
}
