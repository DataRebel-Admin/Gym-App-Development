import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

/**
 * Vereist een ingelogde TENANT_ADMIN. Retourneert de session-user met een
 * gegarandeerd niet-null `tenantId` (tenant-admins horen altijd bij een tenant).
 * Redirect naar /login of /member als dat niet zo is. Defense-in-depth bovenop
 * de proxy-bescherming.
 */
export async function requireOwner() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "TENANT_ADMIN") redirect("/member");
  if (!session.user.tenantId) redirect("/login");
  return { ...session.user, tenantId: session.user.tenantId };
}
