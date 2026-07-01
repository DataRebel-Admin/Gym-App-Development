"use client";

import { useEffect } from "react";
import { ErrorLayout } from "@/components/error/error-layout";
import { buildErrorNav } from "@/lib/errors";

/**
 * Scoped error-boundary voor de member-area. Vangt runtime-fouten binnen één
 * member-pagina op zónder de onderbalk-nav (layout) te unmounten. Root
 * `app/error.tsx` blijft het vangnet voor fouten daarbuiten.
 */
export default function MemberError({
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
