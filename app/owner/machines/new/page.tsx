import Link from "next/link";
import { requireOwner } from "@/lib/owner";
import { getTenantLocations, getDefaultLocationId } from "@/lib/locations";
import { resolveActiveLocationId } from "@/lib/location-resolve";
import { blobConfigured } from "@/lib/blob";
import { MachineForm } from "../machine-form";

export const metadata = { title: "Nieuwe machine" };

export default async function NewMachinePage() {
  const owner = await requireOwner();
  const locations = await getTenantLocations(owner.tenantId);
  // Voorselectie: de actieve vestiging van de admin (device-cookie) → default.
  const activeLocationId = await resolveActiveLocationId(owner.tenantId).catch(() =>
    getDefaultLocationId(owner.tenantId)
  );

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
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

      <MachineForm
        blobEnabled={blobConfigured()}
        locations={locations.map((l) => ({ id: l.id, name: l.name }))}
        defaultLocationId={activeLocationId}
      />
    </div>
  );
}
