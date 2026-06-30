import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/staff";
import { MeasurementForm } from "@/components/progress/measurement-form";
import { createMeasurement } from "../actions";

export const metadata = { title: "Nieuwe meting" };

export default async function NewMeasurementPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const owner = await requirePermission("measurements:manage");
  const { userId } = await params;
  const member = await prisma.user.findFirst({
    where: { id: userId, tenantId: owner.tenantId, role: "TENANT_MEMBER" },
    select: { name: true, email: true },
  });
  if (!member) notFound();

  const action = createMeasurement.bind(null, userId);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <div>
        <Link
          href={`/owner/members/${userId}/progress`}
          className="text-sm text-neutral-500 hover:text-neutral-900"
        >
          ← Voortgang
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900">
          Nieuwe meting
        </h1>
        <p className="mt-1 text-sm text-neutral-500">{member.name ?? member.email}</p>
      </div>
      <MeasurementForm action={action} submitLabel="Meting opslaan" />
    </div>
  );
}
