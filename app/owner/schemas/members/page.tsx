import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/staff";
import {
  ASSIGNMENT_STATUS_META,
  computeValidity,
  fmtDate,
  fmtSince,
  isActiveNow,
} from "@/lib/schema-status";
import { snapshotSelect } from "@/lib/schema-assignments";
import { snapshotOf, asSnapshot, diffSnapshots, hasAnyDiff } from "@/lib/schema-diff";
import {
  MemberSchemaTable,
  type MemberSchemaRow,
  type MemberStatusKey,
} from "@/components/schema/member-schema-table";

export const metadata = { title: "Schema's per lid" };

export default async function MembersPage() {
  const owner = await requirePermission("schemas:manage");

  const members = await prisma.user.findMany({
    where: { tenantId: owner.tenantId, role: "TENANT_MEMBER" },
    orderBy: { name: "asc" },
    include: {
      assignedWorkouts: {
        where: { status: { not: "ARCHIVED" } },
        orderBy: { createdAt: "desc" },
        include: { template: { select: { name: true, validityWeeks: true, ...snapshotSelect } } },
      },
    },
  });

  const now = new Date();
  const rows: MemberSchemaRow[] = members.map((m) => {
    const active = m.assignedWorkouts.find((a) => isActiveNow(a));
    const upcoming = m.assignedWorkouts.find(
      (a) => a.status === "SCHEDULED" || a.status === "DRAFT"
    );
    const show = active ?? upcoming;

    const baseline = show ? asSnapshot(show.baselineSnapshot) : null;
    const personalized =
      show?.template && baseline
        ? hasAnyDiff(diffSnapshots(baseline, snapshotOf(show.template)))
        : false;

    let statusKey: MemberStatusKey = "none";
    if (active) statusKey = "active";
    else if (upcoming?.status === "SCHEDULED") statusKey = "scheduled";
    else if (upcoming?.status === "DRAFT") statusKey = "draft";

    const meta = show ? ASSIGNMENT_STATUS_META[show.status] : null;

    // "Sinds": wanneer kreeg het lid dit (actieve/aankomende) schema.
    // Actief → publicatiedatum (of startdatum); gepland → ingangsdatum.
    const sinceAnchor =
      statusKey === "active"
        ? active!.publishedAt ?? active!.startDate
        : statusKey === "scheduled"
          ? upcoming!.availableFrom ?? upcoming!.startDate
          : null;

    // Verloop-status: alleen zinvol voor een actief (gepubliceerd) schema, geteld
    // vanaf de publicatiedatum + de geldigheidsduur van het schema.
    const validity = active
      ? computeValidity(active.publishedAt, active.template?.validityWeeks ?? null, now)
      : computeValidity(null, null, now);

    return {
      id: m.id,
      name: m.name ?? m.email,
      email: m.email,
      schemaName: show?.template?.name ?? null,
      statusKey,
      statusLabel: meta?.label ?? "Geen",
      statusTone: meta?.tone ?? "neutral",
      personalized,
      sinceLabel: sinceAnchor ? fmtSince(sinceAnchor, now) : "",
      sinceDate: sinceAnchor ? `sinds ${fmtDate(sinceAnchor)}` : "",
      validityState: validity.state,
      validityLabel: validity.label,
      validityTone: validity.tone,
    };
  });

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-neutral-500">
        Wijs leden een schema toe en zie in één oogopslag wie wat heeft — en hoe lang al.
      </p>
      <MemberSchemaTable rows={rows} />
    </div>
  );
}
