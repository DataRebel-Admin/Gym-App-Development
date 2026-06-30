"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOwner } from "@/lib/owner";
import { audit } from "@/lib/audit";

export type ContactFormState = { error?: string; ok?: boolean };

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const SOCIAL_KEYS = ["instagram", "facebook", "twitter", "tiktok", "youtube", "linkedin"] as const;

const contactSchema = z.object({
  addressLine: z.string().trim().max(200).optional(),
  postalCode: z.string().trim().max(20).optional(),
  city: z.string().trim().max(120).optional(),
  country: z.string().trim().max(120).optional(),
  contactPhone: z.string().trim().max(40).optional(),
  contactEmail: z.string().trim().max(160).optional(),
  website: z.string().trim().max(200).optional(),
});

function collectJson(formData: FormData, keys: readonly string[], prefix: string) {
  const out: Record<string, string> = {};
  for (const k of keys) {
    const v = String(formData.get(`${prefix}.${k}`) ?? "").trim();
    if (v) out[k] = v;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Beheer de contactgegevens van de sportschool (owner). Zichtbaar voor leden op /member/gym. */
export async function setTenantContact(
  _prev: ContactFormState,
  formData: FormData
): Promise<ContactFormState> {
  const owner = await requireOwner();

  const parsed = contactSchema.safeParse({
    addressLine: formData.get("addressLine") ?? undefined,
    postalCode: formData.get("postalCode") ?? undefined,
    city: formData.get("city") ?? undefined,
    country: formData.get("country") ?? undefined,
    contactPhone: formData.get("contactPhone") ?? undefined,
    contactEmail: formData.get("contactEmail") ?? undefined,
    website: formData.get("website") ?? undefined,
  });
  if (!parsed.success) return { error: "Controleer de ingevulde velden." };
  const d = parsed.data;

  const email = d.contactEmail || "";
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { error: "Ongeldig e-mailadres." };
  }

  await prisma.tenant.update({
    where: { id: owner.tenantId },
    data: {
      addressLine: d.addressLine || null,
      postalCode: d.postalCode || null,
      city: d.city || null,
      country: d.country || null,
      contactPhone: d.contactPhone || null,
      contactEmail: d.contactEmail || null,
      website: d.website || null,
      openingHours: collectJson(formData, DAY_KEYS, "hours") ?? Prisma.JsonNull,
      socials: collectJson(formData, SOCIAL_KEYS, "social") ?? Prisma.JsonNull,
    },
  });

  await audit("tenant.settings.update", {
    actor: owner,
    tenantId: owner.tenantId,
    targetType: "Tenant",
    targetId: owner.tenantId,
    metadata: { setting: "contact" },
  });

  revalidatePath("/owner/settings");
  revalidatePath("/member/gym");
  return { ok: true };
}

/** Zet de AI-assistent aan of uit voor de tenant van de owner. */
export async function setAiEnabled(formData: FormData) {
  const owner = await requireOwner();
  const enabled = formData.get("enabled") === "true";

  const before = await prisma.tenant.findUnique({
    where: { id: owner.tenantId },
    select: { aiEnabled: true },
  });

  await prisma.tenant.update({
    where: { id: owner.tenantId },
    data: { aiEnabled: enabled },
  });

  await audit("tenant.settings.update", {
    actor: owner,
    tenantId: owner.tenantId,
    targetType: "Tenant",
    targetId: owner.tenantId,
    oldValue: { aiEnabled: before?.aiEnabled ?? null },
    newValue: { aiEnabled: enabled },
    metadata: { setting: "aiEnabled" },
  });

  revalidatePath("/owner/settings");
}
