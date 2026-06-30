import "server-only";
import { unauthorized, forbidden } from "next/navigation";
import { auth } from "@/auth";

/**
 * Vereist een ingelogde SUPERADMIN (platform-beheerder, tenantId == null).
 * Niet ingelogd → premium 401; verkeerde rol → premium 403. Defense-in-depth
 * bovenop de proxy-bescherming op /admin.
 */
export async function requireSuperadmin() {
  const session = await auth();
  if (!session?.user) unauthorized();
  if (session.user.role !== "SUPERADMIN") forbidden();
  return session.user;
}
