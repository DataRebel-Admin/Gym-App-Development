import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireOwner } from "@/lib/owner";
import { SectionHeading } from "@/components/ui/section-heading";
import { Card } from "@/components/ui/card";
import { MapPin } from "@/components/ui/icons";

export const metadata = { title: "Vestigingen" };

/**
 * Vestigingenbeheer (admin-only). Elke organisatie heeft minstens één vestiging;
 * de default-vestiging is het vangnet van de locatie-resolutie en kan niet
 * gearchiveerd worden. Owner-area, bewust NL (precedent maintenance/muscles).
 */
export default async function LocationsPage() {
  const owner = await requireOwner();

  const locations = await prisma.location.findMany({
    where: { tenantId: owner.tenantId },
    orderBy: [{ archivedAt: "asc" }, { isDefault: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      city: true,
      addressLine: true,
      timezone: true,
      isDefault: true,
      archivedAt: true,
      _count: {
        select: {
          machines: true,
          homeUsers: { where: { role: "TENANT_MEMBER", active: true, archivedAt: null } },
          staffAccess: true,
        },
      },
    },
  });

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <SectionHeading
        title="Vestigingen"
        description="Fysieke locaties van je organisatie — apparaten, lessen en trainingen worden per vestiging geregistreerd."
        action={
          <Link
            href="/owner/locations/new"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
          >
            + Nieuwe vestiging
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {locations.map((l) => (
          <Link key={l.id} href={`/owner/locations/${l.id}`}>
            <Card
              className={`flex h-full flex-col gap-2 p-5 transition-transform hover:-translate-y-0.5 ${
                l.archivedAt ? "opacity-60" : ""
              }`}
            >
              <div className="flex items-center gap-2">
                <MapPin className="size-4 text-accent" />
                <span className="font-semibold text-neutral-900">{l.name}</span>
                {l.isDefault ? (
                  <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
                    Hoofdvestiging
                  </span>
                ) : null}
                {l.archivedAt ? (
                  <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                    Gearchiveerd
                  </span>
                ) : null}
              </div>
              <p className="text-sm text-neutral-500">
                {[l.addressLine, l.city].filter(Boolean).join(", ") || "Geen adres ingevuld"}
              </p>
              <p className="mt-auto text-xs text-neutral-400">
                {l._count.homeUsers} leden (thuisvestiging) · {l._count.machines} apparaten ·{" "}
                {l._count.staffAccess} medewerker-koppelingen · {l.timezone}
              </p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
