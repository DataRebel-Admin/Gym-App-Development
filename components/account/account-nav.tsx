"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

export type AccountNavItem = { href: string; label: string; iconPath: string };

/**
 * Verticale account-zijbalk — alléén desktop (`lg+`). Op mobiel navigeert de
 * gebruiker via de settings-hub (`/account`) en de terug-pijl in de topbalk.
 */
export function AccountNav({ items }: { items: AccountNavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {items.map((it) => {
        const active = pathname === it.href;
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-accent-soft text-accent"
                : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
            )}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.9}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-4 shrink-0"
              aria-hidden
            >
              <path d={it.iconPath} />
            </svg>
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
