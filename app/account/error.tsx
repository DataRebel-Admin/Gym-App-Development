"use client";

import { useEffect } from "react";
import { ErrorLayout } from "@/components/error/error-layout";
import { buildErrorNav } from "@/lib/errors";

/** Scoped error-boundary voor de account-hub; behoudt de account-nav-shell. */
export default function AccountError({
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
