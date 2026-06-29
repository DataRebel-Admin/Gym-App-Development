import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

/**
 * Vereist een ingelogde SUPERADMIN (platform-beheerder, tenantId == null).
 * Defense-in-depth bovenop de proxy-bescherming op /admin.
 */
export async function requireSuperadmin() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "SUPERADMIN") redirect("/");
  return session.user;
}
