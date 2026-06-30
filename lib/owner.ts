import "server-only";
import { redirect, unauthorized, forbidden } from "next/navigation";
import { auth } from "@/auth";

/**
 * Vereist een ingelogde TENANT_ADMIN. Retourneert de session-user met een
 * gegarandeerd niet-null `tenantId` (tenant-admins horen altijd bij een tenant).
 * Niet ingelogd → premium 401; verkeerde rol → premium 403 (zie
 * app/unauthorized.tsx / app/forbidden.tsx). Defense-in-depth bovenop de
 * proxy-bescherming.
 */
export async function requireOwner() {
  const session = await auth();
  if (!session?.user) unauthorized();
  if (session.user.role !== "TENANT_ADMIN") forbidden();
  // Data-integriteit: een tenant-admin zonder tenant is een kapotte sessie.
  if (!session.user.tenantId) redirect("/login");
  return { ...session.user, tenantId: session.user.tenantId };
}
