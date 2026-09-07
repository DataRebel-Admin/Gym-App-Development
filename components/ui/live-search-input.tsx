"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Zoekveld dat al typend (debounced) de URL-searchparams bijwerkt, zodat een
 * server-gerenderde lijst live meefiltert zonder op "Filter" te klikken.
 *
 * - Blijft een gewoon `<input name=…>` binnen het GET-formulier: Enter en de
 *   Filter-knop werken onveranderd (progressieve terugval).
 * - `resetParams` (bv. paginering) wordt bij elke nieuwe zoekterm gewist —
 *   anders kijk je op pagina 3 van een vorige zoekopdracht.
 * - Volgt externe wijzigingen (wis-link, terugknop) zonder het veld te
 *   herschrijven terwijl de gebruiker typt.
 */
export function LiveSearchInput({
  paramName = "q",
  resetParams = [],
  placeholder,
  className,
  debounceMs = 350,
}: {
  paramName?: string;
  resetParams?: string[];
  placeholder?: string;
  className?: string;
  debounceMs?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlValue = searchParams.get(paramName) ?? "";
  const [value, setValue] = useState(urlValue);
  const [isPending, startTransition] = useTransition();
  const lastPushed = useRef(urlValue);

  // Externe wijziging (wis-link, terugknop) → veld laten volgen.
  useEffect(() => {
    if (urlValue !== lastPushed.current) {
      lastPushed.current = urlValue;
      setValue(urlValue);
    }
  }, [urlValue]);

  useEffect(() => {
    if (value === lastPushed.current) return;
    const timer = setTimeout(() => {
      lastPushed.current = value;
      const params = new URLSearchParams(searchParams);
      if (value.trim()) params.set(paramName, value);
      else params.delete(paramName);
      for (const p of resetParams) params.delete(p);
      const qs = params.toString();
      startTransition(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    }, debounceMs);
    return () => clearTimeout(timer);
    // searchParams/resetParams bewust niet in de deps: alleen typen triggert.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, paramName, pathname, debounceMs, router]);

  return (
    <input
      type="search"
      name={paramName}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      placeholder={placeholder}
      aria-busy={isPending}
      className={`${className ?? ""}${isPending ? " opacity-70" : ""}`}
    />
  );
}
