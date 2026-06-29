import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { TENANT_HEADER, DEV_FALLBACK_TENANT } from "@/lib/constants";

/**
 * Server-side tenant-context. De proxy zet de tenant-slug in de
 * `x-tenant-slug`-header; hier lezen we die uit en cachen we het Tenant-record
 * per request (React `cache`) zodat herhaalde calls binnen één request niet
 * opnieuw de database raken.
 */
export const getTenantSlug = cache(async (): Promise<string> => {
  const h = await headers();
  return h.get(TENANT_HEADER) ?? DEV_FALLBACK_TENANT;
});

export const getCurrentTenant = cache(async () => {
  const slug = await getTenantSlug();
  return prisma.tenant.findUnique({ where: { slug } });
});
