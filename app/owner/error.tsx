"use client";

import { useEffect } from "react";
import { ErrorLayout } from "@/components/error/error-layout";
import { buildErrorNav } from "@/lib/errors";

/**
 * Scoped error-boundary voor de owner-werkruimte. Vangt runtime-fouten binnen
 * één owner-pagina op zónder de nav-shell (header/zijmenu uit de layout) te
 * unmounten — de gebruiker houdt navigatie en kan het opnieuw proberen. Root
 * `app/error.tsx` blijft de vangnet voor fouten buiten dit segment.
 */
export default function OwnerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return <ErrorLayout code={500} nav={buildErrorNav(null)} reset={reset} />;
}
