"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth, unstable_update } from "@/auth";
import { prisma } from "@/lib/db";
import { AUTH_TENANT_COOKIE } from "@/lib/constants";

/**
 * Wissel naar een andere tenant waar dit e-mailadres óók een account heeft —
 * zonder opnieuw in te loggen. Herschrijft het JWT (id/tenantId/role) via
 * unstable_update en zet de actieve-tenant-cookie zodat de wissel blijft plakken.
 */
export async function switchTenant(formData: FormData) {
  const slug = String(formData.get("slug") ?? "").trim();
  const session = await auth();
  const email = session?.user?.email;
  if (!email || !slug) return;

  const tenant = await prisma.tenant.findFirst({
    where: { slug, status: "ACTIVE", deletedAt: null },
    select: { id: true, slug: true },
  });
  if (!tenant) return;

  const target = await prisma.user.findUnique({
    where: { tenantId_email: { tenantId: tenant.id, email } },
    select: { id: true, role: true, email: true, active: true, archivedAt: true },
  });
  if (!target || !target.active || target.archivedAt) return;
  if (target.role !== "TENANT_ADMIN" && target.role !== "TENANT_MEMBER") return;

  // Actieve-tenant-cookie: zorgt dat de proxy de nieuwe tenant blijft resolven.
  (await cookies()).set(AUTH_TENANT_COOKIE, tenant.slug, { path: "/", sameSite: "lax" });

  // JWT herschrijven naar het account van de doel-tenant.
  await unstable_update({
    tenantSwitch: {
      id: target.id,
      tenantId: tenant.id,
      role: target.role,
      email: target.email,
    },
  } as never);

  redirect(
    target.role === "TENANT_ADMIN"
      ? `/owner?tenant=${tenant.slug}`
      : `/member?tenant=${tenant.slug}`
  );
}
