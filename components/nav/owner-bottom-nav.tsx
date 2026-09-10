"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { m } from "motion/react";
import { cn } from "@/lib/cn";
import { useMobileNav } from "@/components/nav/mobile-nav-provider";

export type OwnerTab = { href: string; label: string; iconPath: string };

const ICON_MORE = "M4 6h16M4 12h16M4 18h16";

function Icon({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5"
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}

/**
 * Mobiele onderbalk voor de beheeromgeving — de tegenhanger van
 * `components/nav/member-nav.tsx`. Zonder deze balk zat élke bestemming in
 * `/owner` op een telefoon achter de hamburger rechtsboven.
 *
 * De tabs komen uit de **al op permissies en feature-flags gefilterde** navigatie
 * van de layout, dus hier staat geen tweede bron van waarheid. De laatste knop
 * opent hetzelfde zijmenu als de hamburger (gedeelde staat via
 * `MobileNavProvider`), zodat alles wat niet in vijf tabs past bereikbaar blijft.
 */
export function OwnerBottomNav({
  tabs,
  rootHref,
  moreLabel,
}: {
  tabs: OwnerTab[];
  rootHref: string;
  moreLabel: string;
}) {
  const pathname = usePathname();
  const nav = useMobileNav();

  const isActive = (href: string) =>
    href === rootHref
      ? pathname === rootHref
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-around border-t border-border bg-surface-1/90 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      {tabs.map((tab) => {
        const active = isActive(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-medium transition-colors",
              active ? "text-accent" : "text-neutral-500"
            )}
          >
            {active ? (
              <m.span
                layoutId="owner-nav-active"
                className="absolute inset-x-1.5 inset-y-1 rounded-xl bg-accent-soft"
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              />
            ) : null}
            <span className="relative z-10">
              <Icon d={tab.iconPath} />
            </span>
            <span className="relative z-10 max-w-full truncate">{tab.label}</span>
          </Link>
        );
      })}
      <button
        type="button"
        onClick={() => nav?.setOpen(true)}
        aria-label={moreLabel}
        aria-expanded={nav?.open ?? false}
        className="relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-medium text-neutral-500 transition-colors"
      >
        <span className="relative z-10">
          <Icon d={ICON_MORE} />
        </span>
        <span className="relative z-10 max-w-full truncate">{moreLabel}</span>
      </button>
    </nav>
  );
}
