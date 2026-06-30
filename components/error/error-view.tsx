import { auth } from "@/auth";
import { buildErrorNav, type DashRole, type ErrorCode } from "@/lib/errors";
import { ErrorLayout } from "./error-layout";
import { RouteSuggestions } from "./route-suggestions";

/**
 * Server-entry voor de premium foutpagina's. Resolved de sessie (rol → juiste
 * dashboard, ingelogd-status) en rendert de gedeelde `ErrorLayout`. Herbruikbaar
 * voor élke foutcode:
 *
 *   - `app/not-found.tsx`      → <ErrorView code={404} />
 *   - `app/forbidden.tsx`      → <ErrorView code={403} />  (via forbidden())
 *   - `app/unauthorized.tsx`   → <ErrorView code={401} />  (via unauthorized())
 *   - een 503-onderhoudspagina → <ErrorView code={503} />
 *
 * De 500 gebruikt bewust `app/error.tsx` (client) omdat die een `reset`-handler
 * krijgt; daar wordt `ErrorLayout` rechtstreeks gebruikt.
 */
export async function ErrorView({ code }: { code: ErrorCode }) {
  const session = await auth();
  const role = (session?.user?.role ?? null) as DashRole | null;
  const nav = buildErrorNav(role);

  return (
    <ErrorLayout code={code} nav={nav}>
      {code === 404 ? <RouteSuggestions role={role} /> : null}
    </ErrorLayout>
  );
}
