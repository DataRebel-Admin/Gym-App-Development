import { auth } from "@/auth";
import {
  buildErrorNav,
  type DashRole,
  type ErrorCode,
  type RouteFeature,
} from "@/lib/errors";
import { areClassesEnabled } from "@/lib/classes";
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

  // Functies die voor déze sportschool uitstaan, zodat we geen pagina
  // voorstellen die zelf ook een 404 geeft. Best-effort: faalt de check, dan
  // suggereren we liever te veel dan niets.
  const disabledFeatures: RouteFeature[] = [];
  const tenantId = session?.user?.tenantId;
  if (code === 404 && tenantId) {
    try {
      if (!(await areClassesEnabled(tenantId))) disabledFeatures.push("group_classes");
    } catch {
      /* stil — suggesties zijn een hulpmiddel, geen kernfunctie */
    }
  }

  return (
    <ErrorLayout code={code} nav={nav}>
      {code === 404 ? (
        <RouteSuggestions role={role} disabledFeatures={disabledFeatures} />
      ) : null}
    </ErrorLayout>
  );
}
