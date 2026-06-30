import "server-only";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { AUTH_TENANT_COOKIE } from "@/lib/constants";

/**
 * Tenant-scoped gebruiker-resolutie voor de wachtwoord-login (gedeeld door de
 * credentials-`authorize` en de login-actions). De tenant-slug komt uit de
 * login-cookie (zoals de magic-link-flow); zonder cookie zoeken we een globale
 * SUPERADMIN. Geeft de volledige `User` terug (incl. passwordHash + 2FA-velden).
 */
export async function resolveLoginUser(emailRaw: string) {
  const email = emailRaw.toLowerCase().trim();
  if (!email) return null;

  const slug = (await cookies()).get(AUTH_TENANT_COOKIE)?.value;
  if (slug) {
    const tenant = await prisma.tenant.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!tenant) return null;
    return prisma.user.findUnique({
      where: { tenantId_email: { tenantId: tenant.id, email } },
    });
  }

  // Geen tenant-cookie → platform-superadmin (tenantId == null).
  return prisma.user.findFirst({
    where: { email, tenantId: null, role: "SUPERADMIN" },
  });
}
