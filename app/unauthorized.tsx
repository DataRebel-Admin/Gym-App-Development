import { ErrorView } from "@/components/error/error-view";

export const metadata = { title: "Niet ingelogd" };

/**
 * Premium 401 — gerenderd wanneer een action/pagina `unauthorized()` aanroept
 * (zie de role-guards). Vereist `experimental.authInterrupts` (next.config.ts).
 */
export default function Unauthorized() {
  return <ErrorView code={401} />;
}
