"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { m } from "motion/react";
import { cn } from "@/lib/cn";

export type NavLink = { href: string; label: string };

/**
 * Owner-navigatie met geanimeerde active-indicator (gedeelde layoutId).
 * Een item is actief als het pathname ermee begint (behalve de dashboard-root,
 * die exact moet matchen).
 */
export function OwnerNav({ links }: { links: NavLink[] }) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/owner") return pathname === "/owner";
    return pathname.startsWith(href);
  }

  return (
    <nav className="flex items-center gap-1">
      {links.map((link) => {
        const active = isActive(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "relative rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "text-neutral-900"
                : "text-neutral-500 hover:text-neutral-900"
            )}
          >
            {active ? (
              <m.span
                layoutId="owner-nav-active"
                className="absolute inset-0 rounded-lg bg-accent-soft"
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              />
            ) : null}
            <span className="relative z-10">{link.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
