import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireOwner } from "@/lib/owner";
import { MachinesTable, type MachineRow } from "./machines-table";

export const metadata = { title: "Apparatuur" };

export default async function MachinesPage() {
  const owner = await requireOwner();

  const machines = await prisma.machine.findMany({
    where: { tenantId: owner.tenantId },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, type: true, imageUrl: true, qrToken: true },
  });

  const rows: MachineRow[] = machines.map((m) => ({
    id: m.id,
    name: m.name,
    type: m.type,
    imageUrl: m.imageUrl,
    hasQr: Boolean(m.qrToken),
  }));

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
            Machines
          </h1>
          <p className="text-sm text-neutral-500">
            {machines.length} machine{machines.length === 1 ? "" : "s"} in jouw
            sportschool.
          </p>
        </div>
        <Link
          href="/owner/machines/new"
          className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground hover:opacity-90"
        >
          Nieuwe machine
        </Link>
      </div>

      <MachinesTable machines={rows} />
    </div>
  );
}
