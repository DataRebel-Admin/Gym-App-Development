import { ErrorView } from "@/components/error/error-view";

export const metadata = { title: "Geen toegang" };

/**
 * Premium 403 — gerenderd wanneer een action/pagina `forbidden()` aanroept
 * (zie de role-guards in lib/owner.ts, lib/member.ts, lib/superadmin.ts).
 * Vereist `experimental.authInterrupts` (next.config.ts).
 */
export default function Forbidden() {
  return <ErrorView code={403} />;
}
