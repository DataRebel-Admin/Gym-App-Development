import { getTranslations } from "next-intl/server";
import { requireMember } from "@/lib/member";
import { prisma } from "@/lib/db";
import { getTenantLocations } from "@/lib/locations";
import { GymContactCard } from "@/components/gym-contact-card";
import { MapPin } from "@/components/ui/icons";

export async function generateMetadata() {
  const t = await getTranslations("member.gym");
  return { title: t("metaTitle") };
}

/**
 * "Mijn sportschool": toont de THUISVESTIGING van het lid (adres/openingstijden
 * van de Location; organisatie-gegevens als vangnet voor lege velden) plus de
 * overige vestigingen van de keten — een lid traint bij élke vestiging zonder
 * tweede lidmaatschap.
 */
export default async function MemberGymPage() {
  const member = await requireMember();
  const t = await getTranslations("member.gym");
  const [tenant, me, locations] = await Promise.all([
    prisma.tenant.findUniqueOrThrow({
      where: { id: member.tenantId },
      select: {
        name: true,
        logoUrl: true,
        addressLine: true,
        postalCode: true,
        city: true,
        country: true,
        contactPhone: true,
        contactEmail: true,
        website: true,
        openingHours: true,
        socials: true,
      },
    }),
    prisma.user.findFirst({
      where: { id: member.id, tenantId: member.tenantId },
      select: { homeLocationId: true },
    }),
    getTenantLocations(member.tenantId),
  ]);

  const home =
    locations.find((l) => l.id === me?.homeLocationId) ??
    locations.find((l) => l.isDefault) ??
    locations[0] ??
    null;
  const homeDetails = home
    ? await prisma.location.findUnique({
        where: { id: home.id },
        select: {
          name: true,
          addressLine: true,
          postalCode: true,
          city: true,
          country: true,
          contactPhone: true,
          contactEmail: true,
          openingHours: true,
        },
      })
    : null;

  const multiLocation = locations.length > 1;
  const others = home ? locations.filter((l) => l.id !== home.id) : [];

  // Vestiging-gegevens winnen; lege velden vallen terug op de organisatie.
  const gym = {
    name: multiLocation && homeDetails ? `${tenant.name} — ${homeDetails.name}` : tenant.name,
    logoUrl: tenant.logoUrl,
    addressLine: homeDetails?.addressLine ?? tenant.addressLine,
    postalCode: homeDetails?.postalCode ?? tenant.postalCode,
    city: homeDetails?.city ?? tenant.city,
    country: homeDetails?.country ?? tenant.country,
    contactPhone: homeDetails?.contactPhone ?? tenant.contactPhone,
    contactEmail: homeDetails?.contactEmail ?? tenant.contactEmail,
    website: tenant.website,
    openingHours: homeDetails?.openingHours ?? tenant.openingHours,
    socials: tenant.socials,
  };

  return (
    <div className="flex flex-1 flex-col gap-5 px-5 py-7">
      <h1 className="font-display text-2xl font-bold tracking-tight text-neutral-900">
        {t("title")}
      </h1>
      <GymContactCard gym={gym} />

      {others.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
            {t("otherLocations")}
          </h2>
          {others.map((l) => (
            <div
              key={l.id}
              className="flex items-center gap-3 rounded-2xl border border-border bg-surface-1 px-4 py-3"
            >
              <MapPin className="size-4 shrink-0 text-accent" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-neutral-900">{l.name}</p>
                {l.city ? <p className="text-xs text-neutral-500">{l.city}</p> : null}
              </div>
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}
