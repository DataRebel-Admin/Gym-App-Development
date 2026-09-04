import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/staff";
import { requireFeature } from "@/lib/features/service";
import { getLocationScope } from "@/lib/location-access";
import { getTenantLocations } from "@/lib/locations";
import { scopeLocationIds } from "@/lib/location-scope";
import { listDefects, mostReportedMachines } from "@/lib/defects-server";
import {
  DefectsDashboard,
  type DefectRow,
  type StaffOption,
} from "@/components/defects/defects-dashboard";

export async function generateMetadata() {
  const t = await getTranslations("owner.defects");
  return { title: t("metaTitle") };
}

/**
 * Defecten-dashboard: zichtbaar voor iedereen met `defects:manage`, gescoped op
 * de vestigingen van de medewerker (fail-closed); de eigenaar ziet de hele
 * organisatie met vestigingsfilter.
 */
export default async function OwnerDefectsPage() {
  const user = await requirePermission("defects:manage");
  await requireFeature(user.tenantId, "defects");
  const t = await getTranslations("owner.defects");

  const scope = await getLocationScope(user);
  const [rows, mostReported, locations, staffUsers] = await Promise.all([
    listDefects(user.tenantId, scope),
    mostReportedMachines(user.tenantId, scope),
    getTenantLocations(user.tenantId),
    prisma.user.findMany({
      where: {
        tenantId: user.tenantId,
        active: true,
        archivedAt: null,
        role: { in: ["TENANT_ADMIN", "TENANT_STAFF"] },
      },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
  ]);

  // Alleen vestigingen binnen de scope tonen als filteroptie.
  const scopedLocationIds = new Set(scopeLocationIds(scope, locations.map((l) => l.id)));
  const locationOptions = locations
    .filter((l) => scopedLocationIds.has(l.id))
    .map((l) => ({ id: l.id, name: l.name }));

  const staff: StaffOption[] = staffUsers.map((s) => ({
    id: s.id,
    name: s.name ?? s.email,
  }));

  // Rendertijd van de server, meegegeven aan het dashboard zodat de
  // periodefilters en leeftijdslabels daar een dependency hebben en niet
  // bevriezen op een oude klok. Zelfde `const now = new Date()`-idioom als
  // /owner/rooster en /member/rooster.
  const now = new Date();

  // Serialisatie: datums → ISO; photoKeys → alléén het aantal (URLs blijven
  // server-side; weergave via de beschermde foto-route).
  const serialized: DefectRow[] = rows.map((r) => ({
    id: r.id,
    machineId: r.machineId,
    machineName: r.machineLabel ?? r.machine?.name ?? "—",
    machineStatus: r.machine?.status ?? null,
    locationId: r.locationId,
    locationName: r.location.name,
    status: r.status,
    severity: r.severity,
    symptom: r.symptom,
    description: r.description,
    photoCount: r.photoKeys.length,
    reporter: r.reportedById ? (r.reportedBy?.name ?? r.reportedBy?.email ?? null) : null,
    assignedToId: r.assignedToId,
    assignedToName: r.assignedTo?.name ?? null,
    confirmations: r._count.confirmations,
    internalNote: r.internalNote,
    resolutionNote: r.resolutionNote,
    createdAt: r.createdAt.toISOString(),
    acknowledgedAt: r.acknowledgedAt?.toISOString() ?? null,
    resolvedAt: r.resolvedAt?.toISOString() ?? null,
    duplicateOfId: r.duplicateOfId,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-neutral-900">
          {t("title")}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">{t("subtitle")}</p>
      </div>
      <DefectsDashboard
        rows={serialized}
        staff={staff}
        locations={locationOptions}
        mostReported={mostReported}
        isAdmin={user.role === "TENANT_ADMIN"}
        now={now.getTime()}
      />
    </div>
  );
}
