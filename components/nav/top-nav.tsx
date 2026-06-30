"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { m } from "motion/react";
import { cn } from "@/lib/cn";

export type TopNavLink = {
  href: string;
  label: string;
  /** SVG path-data voor het icoon (24x24, stroke). */
  iconPath?: string;
};

function NavIcon({ d }: { d: string }) {
  return (
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
      <path d={d} />
    </svg>
  );
}

/**
 * Premium desktop-topnavigatie: geanimeerde active-pill (gedeelde layoutId),
 * iconen + labels, horizontaal scrollbaar op smalle schermen. Een item is actief
 * als het pathname ermee begint (de root moet exact matchen).
 */
export function TopNav({
  links,
  rootHref,
  layoutId,
}: {
  links: TopNavLink[];
  rootHref: string;
  layoutId: string;
}) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === rootHref) return pathname === rootHref;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <nav className="flex items-center gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {links.map((link) => {
        const active = isActive(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "text-accent"
                : "text-neutral-500 hover:bg-neutral-100/70 hover:text-neutral-900"
            )}
          >
            {active ? (
              <m.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-xl bg-accent-soft ring-1 ring-inset ring-accent/15"
                transition={{ type: "spring", stiffness: 480, damping: 38, mass: 0.7 }}
              />
            ) : null}
            {link.iconPath ? (
              <span className="relative z-10">
                <NavIcon d={link.iconPath} />
              </span>
            ) : null}
            <span className="relative z-10 whitespace-nowrap">{link.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
