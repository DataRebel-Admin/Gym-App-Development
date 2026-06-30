import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant";
import { requireOwner } from "@/lib/owner";
import { blobConfigured } from "@/lib/blob";
import { machinePublicUrl } from "@/lib/machine";
import { MachineForm } from "../machine-form";
import { deleteMachine } from "../actions";
import { DownloadQrButton } from "@/components/ui/download-qr-button";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const tenant = await getCurrentTenant();
  const machine = tenant
    ? await prisma.machine.findFirst({
        where: { id, tenantId: tenant.id },
        select: { name: true },
      })
    : null;
  return { title: machine ? `${machine.name} | Apparaat` : "Apparaat" };
}

export default async function MachineDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const owner = await requireOwner();

  const machine = await prisma.machine.findFirst({
    where: { id, tenantId: owner.tenantId },
  });
  if (!machine) notFound();

  const tenant = await prisma.tenant.findUnique({
    where: { id: owner.tenantId },
    select: { slug: true },
  });
  const publicUrl = machinePublicUrl(tenant?.slug ?? "", machine.qrToken);

  return (
    <div className="flex flex-col gap-8 px-6 py-8">
      <div>
        <Link
          href="/owner/machines"
          className="text-sm text-neutral-500 hover:text-neutral-900"
        >
          ← Machines
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900">
          {machine.name}
        </h1>
      </div>

      <MachineForm
        blobEnabled={blobConfigured()}
        machine={{
          id: machine.id,
          name: machine.name,
          type: machine.type,
          description: machine.description,
          instructionsMd: machine.instructionsMd,
          videoUrl: machine.videoUrl,
          imageUrl: machine.imageUrl,
        }}
      />

      <section className="flex max-w-2xl flex-col gap-3 rounded-xl border border-neutral-200 p-5">
        <h2 className="text-sm font-semibold text-neutral-900">QR-code</h2>
        <p className="break-all text-xs text-neutral-500">{publicUrl}</p>
        <div>
          <DownloadQrButton
            url={publicUrl}
            filename={`qr-${machine.name.toLowerCase().replace(/\s+/g, "-")}`}
          />
        </div>
      </section>

      <section className="flex max-w-2xl flex-col gap-3 rounded-xl border border-red-200 p-5">
        <h2 className="text-sm font-semibold text-red-700">Verwijderen</h2>
        <p className="text-sm text-neutral-500">
          Dit verwijdert de machine permanent.
        </p>
        <form action={deleteMachine}>
          <input type="hidden" name="id" value={machine.id} />
          <button
            type="submit"
            className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50"
          >
            Machine verwijderen
          </button>
        </form>
      </section>
    </div>
  );
}
