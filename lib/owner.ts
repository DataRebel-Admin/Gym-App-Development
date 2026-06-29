import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

/**
 * Vereist een ingelogde OWNER. Retourneert de session-user (met id, tenantId,
 * role). Redirect naar /login of /member als dat niet zo is. Defense-in-depth
 * bovenop de proxy-bescherming.
 */
export async function requireOwner() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "OWNER") redirect("/member");
  return session.user;
}
