"use client";

import { useEffect } from "react";
import { ErrorLayout } from "@/components/error/error-layout";
import { buildErrorNav } from "@/lib/errors";

/**
 * Scoped error-boundary voor de superadmin-area. Vangt runtime-fouten binnen
 * één `/admin`-pagina op zónder de nav-shell te unmounten. Root
 * `app/error.tsx` blijft het vangnet voor fouten buiten dit segment.
 */
export default function AdminError({
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
