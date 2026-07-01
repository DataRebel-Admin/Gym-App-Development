import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/staff";
import { Badge } from "@/components/ui/badge";
import { MEMBER_STATUS_META } from "@/lib/member-schema-status";
import { REQUEST_GOAL_LABELS } from "@/lib/schema-requests";
import { fmtDate } from "@/lib/schema-status";

export const metadata = { title: "Zelf-schema's | Schema's" };

export default async function MemberBuiltSchemasPage() {
  const owner = await requirePermission("schemas:manage");

  const rows = await prisma.assignedWorkout.findMany({
    where: {
      tenantId: owner.tenantId,
      origin: "MEMBER",
      memberStatus: { not: "DRAFT" },
    },
    orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      userId: true,
      memberStatus: true,
      goal: true,
      focusNote: true,
      submittedAt: true,
      createdAt: true,
      template: { select: { name: true, _count: { select: { items: true, days: true } } } },
      user: { select: { name: true, email: true } },
    },
  });

  const pending = rows.filter((r) => r.memberStatus === "IN_REVIEW");
  const others = rows.filter((r) => r.memberStatus !== "IN_REVIEW");

  function Row({ r }: { r: (typeof rows)[number] }) {
    const meta = MEMBER_STATUS_META[r.memberStatus ?? "DRAFT"];
    return (
      <li className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border px-4 py-3">
        <div className="min-w-0">
          <p className="font-medium text-neutral-900">
            {r.template?.name ?? "Naamloos schema"}
          </p>
          <p className="text-xs text-neutral-500">
            {r.user.name ?? r.user.email} · {r.template?._count.days ?? 0} dagen ·{" "}
            {r.template?._count.items ?? 0} oefeningen
            {r.goal ? ` · ${REQUEST_GOAL_LABELS[r.goal]}` : ""}
            {r.submittedAt ? ` · ingediend ${fmtDate(r.submittedAt)}` : ""}
          </p>
          {r.focusNote ? (
            <p className="mt-0.5 text-xs italic text-neutral-400">&ldquo;{r.focusNote}&rdquo;</p>
          ) : null}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Badge tone={meta.tone}>{meta.label}</Badge>
          <Link
            href={`/owner/schemas/member-built/${r.id}`}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
          >
            {r.memberStatus === "IN_REVIEW" ? "Beoordelen" : "Bekijken"}
          </Link>
        </div>
      </li>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-neutral-900">Zelf-gebouwde schema&apos;s</h2>
        <p className="text-sm text-neutral-500">
          Schema&apos;s die leden zelf samenstelden. Bekijk, pas aan en keur goed of af.
        </p>
      </div>

      <section className="flex max-w-3xl flex-col gap-3">
        <h3 className="text-sm font-semibold text-neutral-900">
          Wacht op beoordeling ({pending.length})
        </h3>
        {pending.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-neutral-400">
            Geen schema&apos;s in beoordeling.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {pending.map((r) => (
              <Row key={r.id} r={r} />
            ))}
          </ul>
        )}
      </section>

      {others.length > 0 ? (
        <section className="flex max-w-3xl flex-col gap-3">
          <h3 className="text-sm font-semibold text-neutral-900">Overige</h3>
          <ul className="flex flex-col gap-2">
            {others.map((r) => (
              <Row key={r.id} r={r} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
