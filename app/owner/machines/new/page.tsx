import Link from "next/link";
import { requireOwner } from "@/lib/owner";
import { blobConfigured } from "@/lib/blob";
import { MachineForm } from "../machine-form";

export const metadata = { title: "Nieuwe machine" };

export default async function NewMachinePage() {
  await requireOwner();

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <div>
        <Link
          href="/owner/machines"
          className="text-sm text-neutral-500 hover:text-neutral-900"
        >
          ← Machines
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900">
          Nieuwe machine
        </h1>
      </div>

      <MachineForm blobEnabled={blobConfigured()} />
    </div>
  );
}
