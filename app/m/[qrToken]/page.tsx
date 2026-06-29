import { notFound } from "next/navigation";
import Markdown from "react-markdown";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { getCurrentTenant } from "@/lib/tenant";
import { machineTypeLabel } from "@/lib/machine";
import { addMachineToSchema } from "./actions";

export default async function MachinePublicPage({
  params,
}: {
  params: Promise<{ qrToken: string }>;
}) {
  const { qrToken } = await params;

  // Tenant-scoped: een QR hoort alleen bij de actieve sportschool.
  const tenant = await getCurrentTenant();
  if (!tenant) notFound();

  const machine = await prisma.machine.findFirst({
    where: { qrToken, tenantId: tenant.id },
    include: { exercises: { select: { id: true, name: true } } },
  });
  if (!machine) notFound();

  // "Voeg toe aan mijn schema" alleen voor ingelogde leden van deze tenant met schema.
  const session = await auth();
  let canAdd = false;
  if (
    session?.user?.role === "MEMBER" &&
    session.user.tenantId === tenant.id &&
    machine.exercises.length > 0
  ) {
    const assignment = await prisma.assignedWorkout.findFirst({
      where: { tenantId: tenant.id, userId: session.user.id },
    });
    canAdd = Boolean(assignment);
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      {machine.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={machine.imageUrl}
          alt={machine.name}
          className="h-56 w-full object-cover"
        />
      ) : (
        <div className="flex h-40 w-full items-center justify-center bg-neutral-100 text-neutral-400">
          Geen foto
        </div>
      )}

      <div className="flex flex-col gap-5 px-5 py-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
            {machine.name}
          </h1>
          <p className="text-sm text-neutral-500">
            {machineTypeLabel(machine.type)}
          </p>
        </div>

        {machine.description ? (
          <p className="text-neutral-700">{machine.description}</p>
        ) : null}

        {machine.instructionsMd ? (
          <div className="prose prose-sm prose-neutral max-w-none [&_h2]:mt-0 [&_h2]:text-base [&_h2]:font-semibold [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5">
            <Markdown>{machine.instructionsMd}</Markdown>
          </div>
        ) : null}

        {machine.videoUrl ? (
          <div className="aspect-video w-full overflow-hidden rounded-xl border border-neutral-200">
            <iframe
              src={machine.videoUrl}
              title={`Video ${machine.name}`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="h-full w-full"
            />
          </div>
        ) : null}

        {canAdd ? (
          <form action={addMachineToSchema}>
            <input type="hidden" name="machineId" value={machine.id} />
            <button
              type="submit"
              className="w-full rounded-xl border-2 border-neutral-900 px-5 py-3 text-center font-semibold text-neutral-900 active:bg-neutral-50"
            >
              + Voeg toe aan mijn schema
            </button>
          </form>
        ) : null}

        {/* Verplichte veiligheidsmelding — ALTIJD zichtbaar. */}
        <div className="rounded-xl border-2 border-accent bg-accent/5 px-5 py-4 text-center">
          <p className="font-semibold text-neutral-900">
            Twijfel? Vraag een trainer.
          </p>
          <p className="mt-1 text-sm text-neutral-600">
            Bij pijn of onzekerheid over de uitvoering: raadpleeg altijd een
            professional.
          </p>
        </div>
      </div>
    </div>
  );
}
