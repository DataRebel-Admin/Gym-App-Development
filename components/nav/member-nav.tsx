"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { m } from "motion/react";
import { cn } from "@/lib/cn";
import { Dumbbell } from "@/components/ui/icons";

type Item = { href: string; labelKey: string; icon: React.ReactNode };

function Icon({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5"
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}

const NAV: Item[] = [
  { href: "/member", labelKey: "home", icon: <Icon d="M3 10.5 12 4l9 6.5M5 9.5V20h14V9.5" /> },
  { href: "/member/schema", labelKey: "schema", icon: <Icon d="M8 6h11M8 12h11M8 18h11M3.5 6h.01M3.5 12h.01M3.5 18h.01" /> },
  { href: "/member/exercises", labelKey: "exercise", icon: <Dumbbell className="size-5" /> },
  { href: "/member/scan", labelKey: "scan", icon: <Icon d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2M4 12h16" /> },
  { href: "/member/rooster", labelKey: "rooster", icon: <Icon d="M3 9h18M7 3v4M17 3v4M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" /> },
  { href: "/member/history", labelKey: "history", icon: <Icon d="M12 7v5l3 2M3 12a9 9 0 1 0 9-9 9 9 0 0 0-8.5 6M3 4v4h4" /> },
];

/** Mobiele onderbalk met iconen + geanimeerde active-pill. */
export function MemberNav({ classesEnabled = true }: { classesEnabled?: boolean }) {
  const pathname = usePathname();
  const t = useTranslations("nav.member");

  function isActive(href: string) {
    if (href === "/member") return pathname === "/member";
    return pathname.startsWith(href);
  }

  // Lesrooster uitgeschakeld → verberg de rooster-tab (feature-flag per tenant).
  const items = classesEnabled ? NAV : NAV.filter((n) => n.href !== "/member/rooster");

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-md items-center justify-around border-t border-border bg-surface-1/90 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      {items.map((n) => {
        const active = isActive(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-medium transition-colors",
              active ? "text-accent" : "text-neutral-500"
            )}
          >
            {active ? (
              <m.span
                layoutId="member-nav-active"
                className="absolute inset-x-1.5 inset-y-1 rounded-xl bg-accent-soft"
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              />
            ) : null}
            <span className="relative z-10">{n.icon}</span>
            <span className="relative z-10">{t(n.labelKey)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
