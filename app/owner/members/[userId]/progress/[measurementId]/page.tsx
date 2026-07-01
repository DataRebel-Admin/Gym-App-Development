import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/staff";
import { getMeasurement, getEnabledMeasurementKeys } from "@/lib/measurements";
import { getAllowTrainerPhotos } from "@/lib/user-preferences";
import { MeasurementDetail } from "@/components/progress/measurement-detail";
import { MeasurementForm } from "@/components/progress/measurement-form";
import { buttonClasses } from "@/components/ui/button-classes";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { updateMeasurement, deleteMeasurement } from "../actions";

export const metadata = { title: "Meting" };

export default async function MeasurementDetailPage({
  params,
}: {
  params: Promise<{ userId: string; measurementId: string }>;
}) {
  const owner = await requirePermission("measurements:manage");
  const { userId, measurementId } = await params;
  const row = await getMeasurement(owner.tenantId, measurementId, userId);
  if (!row) notFound();

  const [enabled, member] = await Promise.all([
    getEnabledMeasurementKeys(owner.tenantId),
    prisma.user.findFirst({ where: { id: userId, tenantId: owner.tenantId }, select: { preferences: true } }),
  ]);
  const canViewPhotos = getAllowTrainerPhotos(member?.preferences);
  const action = updateMeasurement.bind(null, userId, measurementId);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex items-center justify-between">
        <Link
          href={`/owner/members/${userId}/progress`}
          className="text-sm text-neutral-500 hover:text-neutral-900"
        >
          ← Voortgang
        </Link>
        <ConfirmButton
          action={deleteMeasurement}
          fields={{ userId, measurementId }}
          label="Verwijderen"
          triggerClassName="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
          title="Meting verwijderen?"
          message="Weet je zeker dat je deze meting definitief wilt verwijderen?"
        />
      </div>

      <section className="rounded-2xl border border-border bg-surface-1 p-5">
        <MeasurementDetail row={row} enabled={enabled} canViewPhotos={canViewPhotos} />
      </section>

      <details className="rounded-2xl border border-border bg-surface-1 p-5">
        <summary className={buttonClasses({ variant: "outline", size: "sm", className: "w-fit" })}>
          Meting bewerken
        </summary>
        <div className="mt-5">
          <MeasurementForm action={action} initial={row} submitLabel="Wijzigingen opslaan" enabled={enabled} />
        </div>
      </details>
    </div>
  );
}
