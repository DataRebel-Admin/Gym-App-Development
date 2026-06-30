import { getTranslations } from "next-intl/server";
import { requireMember } from "@/lib/member";
import { prisma } from "@/lib/db";
import { GymContactCard } from "@/components/gym-contact-card";

export async function generateMetadata() {
  const t = await getTranslations("member.gym");
  return { title: t("metaTitle") };
}

export default async function MemberGymPage() {
  const member = await requireMember();
  const t = await getTranslations("member.gym");
  const tenant = await prisma.tenant.findUniqueOrThrow({
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
  });

  return (
    <div className="flex flex-1 flex-col gap-5 px-5 py-7">
      <h1 className="font-display text-2xl font-bold tracking-tight text-neutral-900">
        {t("title")}
      </h1>
      <GymContactCard gym={tenant} />
    </div>
  );
}
