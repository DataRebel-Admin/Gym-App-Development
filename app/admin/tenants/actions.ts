"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSuperadmin } from "@/lib/superadmin";
import { audit } from "@/lib/audit";

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, "Slug te kort")
  .max(40)
  .regex(/^[a-z0-9-]+$/, "Alleen kleine letters, cijfers en koppeltekens");

const hexColor = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "Ongeldige hexkleur")
  .optional()
  .or(z.literal(""));

const createSchema = z.object({
  slug: slugSchema,
  name: z.string().trim().min(1, "Naam is verplicht"),
  locale: z.enum(["NL", "EN", "FY"]),
  accentColor: hexColor,
});

export type TenantFormState = { error?: string };

export async function createTenant(
  _prev: TenantFormState,
  formData: FormData
): Promise<TenantFormState> {
  const admin = await requireSuperadmin();
  const parsed = createSchema.safeParse({
    slug: formData.get("slug"),
    name: formData.get("name"),
    locale: formData.get("locale"),
    accentColor: formData.get("accentColor") || "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ongeldige invoer" };

  const { slug, name, locale, accentColor } = parsed.data;

  const clash = await prisma.tenant.findUnique({ where: { slug } });
  if (clash) return { error: `Slug '${slug}' bestaat al` };

  const tenant = await prisma.tenant.create({
    data: { slug, name, locale, accentColor: accentColor || null },
  });
  await audit("tenant.create", {
    actor: admin,
    tenantId: tenant.id,
    targetType: "Tenant",
    targetId: tenant.id,
    metadata: { slug, name },
  });

  revalidatePath("/admin/tenants");
  redirect(`/admin/tenants/${tenant.id}`);
}

const updateSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1, "Naam is verplicht"),
  locale: z.enum(["NL", "EN", "FY"]),
});

export async function updateTenant(
  _prev: TenantFormState,
  formData: FormData
): Promise<TenantFormState> {
  const admin = await requireSuperadmin();
  const parsed = updateSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    locale: formData.get("locale"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ongeldige invoer" };

  const { id, name, locale } = parsed.data;
  await prisma.tenant.update({ where: { id }, data: { name, locale } });
  await audit("tenant.update", { actor: admin, tenantId: id, targetType: "Tenant", targetId: id, metadata: { name, locale } });

  revalidatePath(`/admin/tenants/${id}`);
  return {};
}

const brandingSchema = z.object({
  id: z.string().min(1),
  accentColor: hexColor,
  secondaryColor: hexColor,
  logoUrl: z.string().trim().url().optional().or(z.literal("")),
  faviconUrl: z.string().trim().url().optional().or(z.literal("")),
  fontFamily: z.string().trim().max(80).optional().or(z.literal("")),
});

export async function updateBranding(
  _prev: TenantFormState,
  formData: FormData
): Promise<TenantFormState> {
  const admin = await requireSuperadmin();
  const parsed = brandingSchema.safeParse({
    id: formData.get("id"),
    accentColor: formData.get("accentColor") || "",
    secondaryColor: formData.get("secondaryColor") || "",
    logoUrl: formData.get("logoUrl") || "",
    faviconUrl: formData.get("faviconUrl") || "",
    fontFamily: formData.get("fontFamily") || "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ongeldige invoer" };

  const { id, accentColor, secondaryColor, logoUrl, faviconUrl, fontFamily } = parsed.data;
  await prisma.tenant.update({
    where: { id },
    data: {
      accentColor: accentColor || null,
      secondaryColor: secondaryColor || null,
      logoUrl: logoUrl || null,
      faviconUrl: faviconUrl || null,
      fontFamily: fontFamily || null,
    },
  });
  await audit("branding.update", { actor: admin, tenantId: id, targetType: "Tenant", targetId: id });

  revalidatePath(`/admin/tenants/${id}`);
  return {};
}

export async function setTenantStatus(formData: FormData) {
  const admin = await requireSuperadmin();
  const id = String(formData.get("id") ?? "");
  const status = formData.get("status") === "INACTIVE" ? "INACTIVE" : "ACTIVE";
  if (!id) return;

  await prisma.tenant.update({ where: { id }, data: { status } });
  await audit(status === "INACTIVE" ? "tenant.deactivate" : "tenant.activate", {
    actor: admin,
    tenantId: id,
    targetType: "Tenant",
    targetId: id,
  });

  revalidatePath(`/admin/tenants/${id}`);
  revalidatePath("/admin/tenants");
}

/** Soft-delete: markeert de tenant als verwijderd (deletedAt) + inactief. */
export async function deleteTenant(formData: FormData) {
  const admin = await requireSuperadmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await prisma.tenant.update({
    where: { id },
    data: { deletedAt: new Date(), status: "INACTIVE" },
  });
  await audit("tenant.delete", { actor: admin, tenantId: id, targetType: "Tenant", targetId: id });

  revalidatePath("/admin/tenants");
  redirect("/admin/tenants");
}
