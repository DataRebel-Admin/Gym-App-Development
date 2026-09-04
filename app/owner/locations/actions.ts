"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireOwner } from "@/lib/owner";
import { audit } from "@/lib/audit";
import { LOCATION_TIMEZONES } from "@/lib/location-timezones";
import { firstValidationError } from "@/lib/validation-message";

// Vestigingenbeheer is admin-only (permissie locations:manage zit in de
// admin-superset; requireOwner dekt dat af — een medewerker komt hier nooit).

export type LocationFormState = { error?: string };

// Zelfde dag-sleutels + verzamel-idioom als de tenant-openingstijden
// (app/account/actions.ts): inputs heten `hours_<dag>`, lege dagen vallen weg.
const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

function collectHours(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of DAY_KEYS) {
    const v = String(formData.get(`hours_${k}`) ?? "").trim();
    if (v) out[k] = v;
  }
  return out;
}

const locationSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "nameRequired").max(80),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]*$/, "invalidSlug")
    .max(40)
    .optional()
    .or(z.literal("")),
  addressLine: z.string().trim().max(120).optional().or(z.literal("")),
  postalCode: z.string().trim().max(12).optional().or(z.literal("")),
  city: z.string().trim().max(80).optional().or(z.literal("")),
  country: z.string().trim().max(60).optional().or(z.literal("")),
  contactPhone: z.string().trim().max(30).optional().or(z.literal("")),
  contactEmail: z.string().trim().email("invalidEmail").optional().or(z.literal("")),
  timezone: z.enum(LOCATION_TIMEZONES),
});

/** Vestiging aanmaken of bewerken (gescoped op de eigen tenant). */
export async function saveLocation(
  _prev: LocationFormState,
  formData: FormData
): Promise<LocationFormState> {
  const owner = await requireOwner();
  const parsed = locationSchema.safeParse({
    id: formData.get("id") || undefined,
    name: formData.get("name"),
    slug: formData.get("slug") || "",
    addressLine: formData.get("addressLine") || "",
    postalCode: formData.get("postalCode") || "",
    city: formData.get("city") || "",
    country: formData.get("country") || "",
    contactPhone: formData.get("contactPhone") || "",
    contactEmail: formData.get("contactEmail") || "",
    timezone: formData.get("timezone") || "Europe/Amsterdam",
  });
  if (!parsed.success) return { error: await firstValidationError(parsed.error) };
  const d = parsed.data;

  // Openingstijden per vestiging: alle dagen leeg = openingstijden wissen
  // (het lid ziet dan de organisatie-tijden als vangnet, zie /member/gym).
  const hours = collectHours(formData);

  const data = {
    name: d.name,
    slug: d.slug || null,
    addressLine: d.addressLine || null,
    postalCode: d.postalCode || null,
    city: d.city || null,
    country: d.country || null,
    contactPhone: d.contactPhone || null,
    contactEmail: d.contactEmail || null,
    timezone: d.timezone,
    openingHours: Object.keys(hours).length ? hours : Prisma.DbNull,
  };

  let locationId = d.id ?? null;
  try {
    if (d.id) {
      const res = await prisma.location.updateMany({
        where: { id: d.id, tenantId: owner.tenantId },
        data,
      });
      if (res.count === 0) return { error: "Vestiging niet gevonden" };
      await audit("location.update", {
        actor: owner,
        tenantId: owner.tenantId,
        locationId: d.id,
        targetType: "Location",
        targetId: d.id,
        newValue: { name: d.name },
        metadata: { name: d.name },
      });
    } else {
      const created = await prisma.location.create({
        data: { tenantId: owner.tenantId, ...data },
      });
      locationId = created.id;
      await audit("location.create", {
        actor: owner,
        tenantId: owner.tenantId,
        locationId: created.id,
        targetType: "Location",
        targetId: created.id,
        metadata: { name: d.name },
      });
    }
  } catch (err) {
    // Uniek per tenant op naam/slug.
    if ((err as { code?: string }).code === "P2002") {
      return { error: "Er bestaat al een vestiging met deze naam of slug" };
    }
    throw err;
  }

  revalidatePath("/owner/locations");
  redirect(`/owner/locations/${locationId}`);
}

/** Maak deze vestiging de default (precies één per tenant — atomair). */
export async function setDefaultLocation(formData: FormData) {
  const owner = await requireOwner();
  const id = String(formData.get("id") ?? "");
  const location = await prisma.location.findFirst({
    where: { id, tenantId: owner.tenantId, archivedAt: null },
    select: { id: true, name: true },
  });
  if (!location) return;

  await prisma.$transaction([
    prisma.location.updateMany({
      where: { tenantId: owner.tenantId, isDefault: true },
      data: { isDefault: false },
    }),
    prisma.location.update({ where: { id: location.id }, data: { isDefault: true } }),
  ]);
  await audit("location.default.change", {
    actor: owner,
    tenantId: owner.tenantId,
    locationId: location.id,
    targetType: "Location",
    targetId: location.id,
    metadata: { name: location.name },
  });
  revalidatePath("/owner/locations");
  revalidatePath(`/owner/locations/${location.id}`);
}

/**
 * Archiveer/heropen een vestiging. De default-vestiging is nooit archiveerbaar
 * (er moet altijd een vestiging overblijven); historie blijft bestaan (Restrict-
 * FK's verhinderen hard verwijderen sowieso). Een vestiging met nog geplande
 * groepslessen is evenmin archiveerbaar: die sessies zouden boekbaar blijven
 * op een gesloten locatie — eerst verplaatsen of verwijderen (de melding op de
 * detailpagina legt dat uit).
 */
export async function setLocationArchived(formData: FormData) {
  const owner = await requireOwner();
  const id = String(formData.get("id") ?? "");
  const archive = String(formData.get("archive") ?? "") === "1";
  const location = await prisma.location.findFirst({
    where: { id, tenantId: owner.tenantId },
    select: { id: true, name: true, isDefault: true },
  });
  if (!location) return;
  if (archive && location.isDefault) return; // default nooit archiveren
  if (archive) {
    const upcoming = await prisma.classSession.count({
      where: { tenantId: owner.tenantId, locationId: location.id, startsAt: { gt: new Date() } },
    });
    if (upcoming > 0) redirect(`/owner/locations/${location.id}?err=lessen&count=${upcoming}`);
  }

  await prisma.location.update({
    where: { id: location.id },
    data: { archivedAt: archive ? new Date() : null },
  });
  await audit(archive ? "location.archive" : "location.unarchive", {
    actor: owner,
    tenantId: owner.tenantId,
    locationId: location.id,
    targetType: "Location",
    targetId: location.id,
    metadata: { name: location.name },
  });
  revalidatePath("/owner/locations");
  revalidatePath(`/owner/locations/${location.id}`);
}

/**
 * Koppel of ontkoppel een medewerker aan/van deze vestiging
 * (StaffLocationAccess — RESTRICTIEF: zonder koppelingen ziet staff niets).
 */
export async function setStaffLocationAccess(formData: FormData) {
  const owner = await requireOwner();
  const userId = String(formData.get("userId") ?? "");
  const locationId = String(formData.get("locationId") ?? "");
  const grant = String(formData.get("grant") ?? "") === "1";

  const [staff, location] = await Promise.all([
    prisma.user.findFirst({
      where: { id: userId, tenantId: owner.tenantId, role: "TENANT_STAFF" },
      select: { id: true, name: true, email: true },
    }),
    prisma.location.findFirst({
      where: { id: locationId, tenantId: owner.tenantId },
      select: { id: true, name: true },
    }),
  ]);
  if (!staff || !location) return;

  if (grant) {
    await prisma.staffLocationAccess.upsert({
      where: {
        tenantId_userId_locationId: {
          tenantId: owner.tenantId,
          userId: staff.id,
          locationId: location.id,
        },
      },
      update: {},
      create: {
        tenantId: owner.tenantId,
        userId: staff.id,
        locationId: location.id,
        assignedById: owner.id,
      },
    });
  } else {
    await prisma.staffLocationAccess.deleteMany({
      where: { tenantId: owner.tenantId, userId: staff.id, locationId: location.id },
    });
  }
  await audit(grant ? "staff.location.assign" : "staff.location.unassign", {
    actor: owner,
    tenantId: owner.tenantId,
    locationId: location.id,
    targetType: "User",
    targetId: staff.id,
    metadata: { staff: staff.name ?? staff.email, name: location.name },
  });
  revalidatePath(`/owner/locations/${location.id}`);
  revalidatePath("/owner/staff");
}
