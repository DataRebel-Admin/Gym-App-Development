import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Markdown from "react-markdown";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { getCurrentTenant } from "@/lib/tenant";
import { machineTypeLabel } from "@/lib/machine";
import { Badge } from "@/components/ui/badge";
import { Dumbbell, Plus, ChevronRight } from "@/components/ui/icons";
import { addMachineToSchema } from "./actions";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ qrToken: string }>;
}): Promise<Metadata> {
  const { qrToken } = await params;
  const tenant = await getCurrentTenant();
  const machine = tenant
    ? await prisma.machine.findFirst({
        where: { qrToken, tenantId: tenant.id },
        select: { name: true },
      })
    : null;
  return { title: machine ? `${machine.name} | Apparaat` : "Apparaat" };
}

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
    include: {
      exercises: {
        select: {
          id: true,
          name: true,
          targetMuscle: true,
          catalog: { select: { gifUrl: true, imageUrl: true, target: true } },
        },
      },
    },
  });
  if (!machine) notFound();

  // "Voeg toe aan mijn schema" alleen voor ingelogde leden van deze tenant met schema.
  const session = await auth();
  const isMember =
    session?.user?.role === "TENANT_MEMBER" && session.user.tenantId === tenant.id;
  let canAdd = false;
  if (isMember && machine.exercises.length > 0) {
    const now = new Date();
    const active = await prisma.assignedWorkout.findFirst({
      where: {
        tenantId: tenant.id,
        userId: session!.user.id,
        status: "PUBLISHED",
        OR: [{ availableFrom: null }, { availableFrom: { lte: now } }],
        AND: [{ OR: [{ endDate: null }, { endDate: { gte: now } }] }],
      },
      select: { id: true },
    });
    canAdd = Boolean(active);
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 py-6">
      {/* Hero */}
      {machine.imageUrl ? (
        <div className="overflow-hidden rounded-3xl border border-border bg-surface-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={machine.imageUrl}
            alt={machine.name}
            className="h-56 w-full object-cover"
          />
        </div>
      ) : (
        <div className="flex h-44 w-full items-center justify-center rounded-3xl bg-accent-soft text-accent">
          <Dumbbell className="size-12" />
        </div>
      )}

      <div className="mt-5 flex flex-col gap-5">
        <div>
          <Badge tone="accent">{machineTypeLabel(machine.type)}</Badge>
          <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-neutral-900">
            {machine.name}
          </h1>
        </div>

        {machine.description ? (
          <p className="text-neutral-700">{machine.description}</p>
        ) : null}

        {machine.instructionsMd ? (
          <div className="prose prose-sm prose-neutral max-w-none rounded-3xl border border-border bg-surface-1 p-5 [&_h2]:mt-0 [&_h2]:text-base [&_h2]:font-semibold [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5">
            <Markdown>{machine.instructionsMd}</Markdown>
          </div>
        ) : null}

        {machine.videoUrl ? (
          <div className="aspect-video w-full overflow-hidden rounded-2xl border border-border">
            <iframe
              src={machine.videoUrl}
              title={`Video ${machine.name}`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="h-full w-full"
            />
          </div>
        ) : null}

        {machine.exercises.length > 0 ? (
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-neutral-900">
              Oefeningen op dit apparaat
            </h2>
            <ul className="flex flex-col gap-2">
              {machine.exercises.map((ex) => {
                const thumb = ex.catalog?.imageUrl ?? ex.catalog?.gifUrl ?? null;
                const muscle = ex.targetMuscle ?? ex.catalog?.target ?? null;
                const inner = (
                  <>
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={thumb}
                        alt=""
                        aria-hidden
                        loading="lazy"
                        className="h-12 w-12 shrink-0 rounded-xl object-cover"
                      />
                    ) : (
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                        <Dumbbell className="size-5" />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium capitalize text-neutral-900">
                        {ex.name}
                      </p>
                      {muscle ? (
                        <p className="truncate text-xs capitalize text-neutral-500">
                          {muscle}
                        </p>
                      ) : null}
                    </div>
                    {isMember ? (
                      <ChevronRight className="size-4 shrink-0 text-neutral-300" />
                    ) : null}
                  </>
                );
                return (
                  <li key={ex.id}>
                    {isMember ? (
                      <Link
                        href={`/member/history/exercise/${ex.id}`}
                        className="flex items-center gap-3 rounded-2xl border border-border bg-surface-1 p-2.5 shadow-sm active:bg-surface-2"
                      >
                        {inner}
                      </Link>
                    ) : (
                      <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface-1 p-2.5 shadow-sm">
                        {inner}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {canAdd ? (
          <form action={addMachineToSchema}>
            <input type="hidden" name="machineId" value={machine.id} />
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-accent px-5 py-3.5 text-center font-semibold text-accent active:bg-accent-soft"
            >
              <Plus className="size-5" /> Voeg toe aan mijn schema
            </button>
          </form>
        ) : null}

        {/* Verplichte veiligheidsmelding — ALTIJD zichtbaar. */}
        <div className="rounded-2xl border-2 border-accent bg-accent-soft px-5 py-4 text-center">
          <p className="font-semibold text-neutral-900">Twijfel? Vraag een trainer.</p>
          <p className="mt-1 text-sm text-neutral-600">
            Bij pijn of onzekerheid over de uitvoering: raadpleeg altijd een professional.
          </p>
        </div>
      </div>
    </div>
  );
}
