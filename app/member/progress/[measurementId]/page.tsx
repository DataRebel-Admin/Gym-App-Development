import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMember } from "@/lib/member";
import { getMeasurement } from "@/lib/measurements";
import { MeasurementDetail } from "@/components/progress/measurement-detail";

export const metadata = { title: "Meting" };

export default async function MemberMeasurementPage({
  params,
}: {
  params: Promise<{ measurementId: string }>;
}) {
  const member = await requireMember();
  const { measurementId } = await params;
  // Tenant + eigen userId enforced — een lid ziet alleen eigen metingen.
  const row = await getMeasurement(member.tenantId, measurementId, member.id);
  if (!row) notFound();

  return (
    <div className="flex flex-col gap-6 px-4 py-6">
      <Link href="/member/progress" className="text-sm text-neutral-500 hover:text-neutral-900">
        ← Mijn voortgang
      </Link>
      <section className="rounded-2xl border border-border bg-surface-1 p-5">
        <MeasurementDetail row={row} />
      </section>
    </div>
  );
}
