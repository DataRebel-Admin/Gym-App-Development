import { requirePermission } from "@/lib/staff";
import { prisma } from "@/lib/db";
import { isActiveNow } from "@/lib/schema-status";
import { SchemaBulkPanel } from "@/components/schema-bulk-panel";

export const metadata = { title: "Bulkwijzigingen" };

export default async function BulkPage() {
  const owner = await requirePermission("schemas:manage");

  const rows = await prisma.user.findMany({
    where: { tenantId: owner.tenantId, role: "TENANT_MEMBER", active: true, archivedAt: null },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      assignedWorkouts: {
        where: { status: "PUBLISHED" },
        orderBy: { publishedAt: "desc" },
        select: { availableFrom: true, endDate: true, status: true, template: { select: { name: true } } },
      },
    },
  });

  // Alleen leden met een actief (nu zichtbaar) schema — daar grijpt de bulk op in.
  const members = rows
    .map((m) => {
      const active = m.assignedWorkouts.find((a) => isActiveNow(a));
      return {
        id: m.id,
        name: m.name,
        email: m.email,
        schemaName: active?.template?.name ?? null,
        hasActive: Boolean(active),
      };
    })
    .filter((m) => m.hasActive)
    .map(({ hasActive: _hasActive, ...m }) => m);

  const exercises = await prisma.exercise.findMany({
    where: { tenantId: owner.tenantId, archivedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div>
        <h2 className="text-sm font-semibold text-neutral-900">Bulkwijzigingen</h2>
        <p className="text-sm text-neutral-500">
          Pas in één keer een wijziging toe op de actieve schema&apos;s van meerdere
          leden — bijvoorbeeld gewicht +5 kg of een extra oefening. Persoonlijke
          schema&apos;s blijven behouden; de master-templates worden niet gewijzigd.
        </p>
      </div>
      <SchemaBulkPanel members={members} exercises={exercises} />
    </div>
  );
}
