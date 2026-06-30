import { prisma } from "@/lib/db";
import { requireOwner } from "@/lib/owner";
import { TenantForm, type TenantBusiness } from "./tenant-form";

function asRecord(v: unknown): Record<string, string> | null {
  return v && typeof v === "object" ? (v as Record<string, string>) : null;
}

export default async function AccountTenantPage() {
  const owner = await requireOwner();
  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: owner.tenantId },
    select: {
      contactEmail: true, contactPhone: true, addressLine: true, postalCode: true,
      city: true, country: true, website: true, vatNumber: true, cocNumber: true,
      socials: true, openingHours: true,
    },
  });

  const data: TenantBusiness = {
    contactEmail: tenant.contactEmail,
    contactPhone: tenant.contactPhone,
    addressLine: tenant.addressLine,
    postalCode: tenant.postalCode,
    city: tenant.city,
    country: tenant.country,
    website: tenant.website,
    vatNumber: tenant.vatNumber,
    cocNumber: tenant.cocNumber,
    socials: asRecord(tenant.socials),
    openingHours: asRecord(tenant.openingHours),
  };

  return <TenantForm tenant={data} />;
}
