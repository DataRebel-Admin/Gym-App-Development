import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireOwner } from "@/lib/owner";
import { SectionHeading } from "@/components/ui/section-heading";
import { Card } from "@/components/ui/card";
import { LocationForm } from "../location-form";
import { setDefaultLocation, setLocationArchived, setStaffLocationAccess } from "../actions";

export const metadata = { title: "Vestiging" };

/**
 * Vestiging-detail (admin-only): gegevens bewerken, default/archief-beheer en
 * de medewerker-toegangsmatrix. LET OP: de koppeling is RESTRICTIEF — een
 * medewerker zonder koppelingen ziet geen enkele vestiging (fail-closed).
 */
export default async function LocationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const owner = await requireOwner();

  const [location, staff] = await Promise.all([
    prisma.location.findFirst({
      where: { id, tenantId: owner.tenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        addressLine: true,
        postalCode: true,
        city: true,
        country: true,
        contactPhone: true,
        contactEmail: true,
        timezone: true,
        isDefault: true,
        archivedAt: true,
      },
    }),
    prisma.user.findMany({
      where: { tenantId: owner.tenantId, role: "TENANT_STAFF", active: true, archivedAt: null },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        staffLocationAccess: { select: { locationId: true } },
      },
    }),
  ]);
  if (!location) notFound();

  return (
    <div className="flex flex-col gap-8 px-4 py-6 sm:px-6 sm:py-8">
      <div>
        <Link href="/owner/locations" className="text-sm text-neutral-500 hover:text-neutral-900">
          ← Vestigingen
        </Link>
        <SectionHeading
          title={location.name}
          description={
            location.isDefault
              ? "Hoofdvestiging — vangnet van de locatie-resolutie, niet archiveerbaar."
              : location.archivedAt
                ? "Gearchiveerd — telt niet meer mee in pickers en analytics-scope."
                : "Vestiging van je organisatie."
          }
          action={
            <div className="flex gap-2">
              {!location.isDefault && !location.archivedAt ? (
                <form action={setDefaultLocation}>
                  <input type="hidden" name="id" value={location.id} />
                  <button className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-surface-2">
                    Maak hoofdvestiging
                  </button>
                </form>
              ) : null}
              {!location.isDefault ? (
                <form action={setLocationArchived}>
                  <input type="hidden" name="id" value={location.id} />
                  <input type="hidden" name="archive" value={location.archivedAt ? "0" : "1"} />
                  <button className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-surface-2">
                    {location.archivedAt ? "Heropen vestiging" : "Archiveer vestiging"}
                  </button>
                </form>
              ) : null}
            </div>
          }
        />
      </div>

      <LocationForm location={location} />

      <section className="flex max-w-2xl flex-col gap-3">
        <h2 className="text-lg font-semibold text-neutral-900">Medewerker-toegang</h2>
        <p className="text-sm text-neutral-500">
          Een medewerker ziet uitsluitend de vestigingen waaraan hij gekoppeld is — zonder
          koppelingen ziet hij níéts (anders dan de coach-koppeling, die een extra lens is).
        </p>
        <Card className="divide-y divide-border p-0">
          {staff.length === 0 ? (
            <p className="px-5 py-6 text-sm text-neutral-500">
              Nog geen medewerkers — nodig ze uit via{" "}
              <Link href="/owner/staff" className="text-accent underline">
                Medewerkers
              </Link>
              .
            </p>
          ) : (
            staff.map((s) => {
              const linked = s.staffLocationAccess.some((a) => a.locationId === location.id);
              return (
                <div key={s.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-neutral-900">
                      {s.name ?? s.email}
                    </p>
                    <p className="truncate text-xs text-neutral-500">{s.email}</p>
                  </div>
                  <form action={setStaffLocationAccess}>
                    <input type="hidden" name="userId" value={s.id} />
                    <input type="hidden" name="locationId" value={location.id} />
                    <input type="hidden" name="grant" value={linked ? "0" : "1"} />
                    <button
                      className={
                        linked
                          ? "rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-surface-2"
                          : "rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground hover:opacity-90"
                      }
                    >
                      {linked ? "Ontkoppelen" : "Koppelen"}
                    </button>
                  </form>
                </div>
              );
            })
          )}
        </Card>
      </section>
    </div>
  );
}
