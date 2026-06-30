"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";

/**
 * Volledig klikbare tabelrij (i.p.v. alleen een link in één cel). Navigeert naar
 * `href` bij klik of Enter/Spatie en toont een hover-/focus-highlight. Prefetcht
 * bij hover voor een snappy gevoel. Echte interactieve elementen in een cel
 * (knop/link/checkbox) blijven werken: hun klik wordt niet doorgegeven aan de rij.
 */
export function TableRowLink({
  href,
  label,
  className,
  children,
}: {
  href: string;
  /** Toegankelijke omschrijving van de bestemming (aria-label). */
  label?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();

  return (
    <tr
      role="link"
      tabIndex={0}
      aria-label={label}
      onClick={() => router.push(href)}
      onMouseEnter={() => router.prefetch(href)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(href);
        }
      }}
      className={cn(
        "cursor-pointer transition-colors hover:bg-neutral-100/60 focus-ring focus:bg-neutral-100/60",
        className
      )}
    >
      {children}
    </tr>
  );
}
