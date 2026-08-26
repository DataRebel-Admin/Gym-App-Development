"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { cn } from "@/lib/cn";
import type { Permission } from "@/lib/rbac";

export type OwnerNavItem = {
  href: string;
  label: string;
  /** SVG path-data voor het icoon (24x24, stroke). */
  iconPath?: string;
  /** Korte omschrijving in het mega-menu-paneel. */
  description?: string;
  /** Vereiste permissie om dit item te tonen (medewerker). Leeg = altijd zichtbaar. */
  permission?: Permission;
  /** Uitsluitend voor de eigenaar (TENANT_ADMIN); verborgen voor medewerkers. */
  adminOnly?: boolean;
};

export type OwnerNavEntry =
  | {
      type: "link";
      href: string;
      label: string;
      iconPath?: string;
      permission?: Permission;
      adminOnly?: boolean;
    }
  | {
      type: "group";
      key: string;
      label: string;
      iconPath?: string;
      items: OwnerNavItem[];
    };

function NavIcon({ d, className }: { d: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("size-4 shrink-0", className)}
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}

/**
 * Topnavigatie voor de tenant-admin (owner). In plaats van een horizontaal
 * scrollende rij met alle bestemmingen, groeperen we de items in categorieën
 * die uitklappen in een mega-menu-paneel. Losse, veelgebruikte bestemmingen
 * (Dashboard, Instellingen) blijven directe links.
 *
 * Een paneel opent bij hover (desktop) of klik en sluit bij klik buiten de nav,
 * Escape, navigatie of het verlaten van de nav.
 */
export function OwnerNav({
  entries,
  rootHref,
}: {
  entries: OwnerNavEntry[];
  rootHref: string;
}) {
  const pathname = usePathname();
  // Het open paneel onthoudt bij welk pad het geopend werd: navigeren maakt de
  // afgeleide `open` vanzelf null (sluiten bij navigatie zonder effect).
  const [openedAt, setOpenedAt] = useState<{
    key: string;
    path: string;
  } | null>(null);
  const open = openedAt && openedAt.path === pathname ? openedAt.key : null;
  const setOpen = (key: string | null) =>
    setOpenedAt(key ? { key, path: pathname } : null);
  const navRef = useRef<HTMLElement>(null);

  // Sluit bij klik buiten de nav of Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node))
        setOpenedAt(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenedAt(null);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const itemActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);
  const linkActive = (href: string) =>
    href === rootHref ? pathname === rootHref : itemActive(href);

  return (
    <nav
      ref={navRef}
      className="flex items-center gap-0.5"
      onMouseLeave={() => setOpen(null)}
    >
      {entries.map((entry) => {
        if (entry.type === "link") {
          const active = linkActive(entry.href);
          return (
            <Link
              key={entry.href}
              href={entry.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-accent-soft text-accent ring-1 ring-inset ring-accent/15"
                  : "text-neutral-500 hover:bg-neutral-100/70 hover:text-neutral-900",
              )}
            >
              {entry.iconPath ? <NavIcon d={entry.iconPath} /> : null}
              <span className="whitespace-nowrap">{entry.label}</span>
            </Link>
          );
        }

        const active = entry.items.some((i) => itemActive(i.href));
        const isOpen = open === entry.key;
        return (
          <div
            key={entry.key}
            className="relative"
            onMouseEnter={() => setOpen(entry.key)}
          >
            <button
              type="button"
              aria-haspopup="true"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : entry.key)}
              className={cn(
                "relative flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                active || isOpen
                  ? "text-accent"
                  : "text-neutral-500 hover:bg-neutral-100/70 hover:text-neutral-900",
                active && "bg-accent-soft ring-1 ring-inset ring-accent/15",
              )}
            >
              {entry.iconPath ? <NavIcon d={entry.iconPath} /> : null}
              <span className="whitespace-nowrap">{entry.label}</span>
              <NavIcon
                d="M6 9l6 6 6-6"
                className={cn(
                  "size-3.5 transition-transform duration-200",
                  isOpen && "rotate-180",
                )}
              />
            </button>

            <AnimatePresence>
              {isOpen ? (
                /* De ruimte tussen knop en paneel is PADDING op het
                   geanimeerde element, geen marge op het paneel. Een marge ligt buiten de <nav>:
                   de muis verliet dan tijdens het oversteken de nav
                   (onMouseLeave → sluiten) en landde vervolgens op het nog
                   uitfadende paneel (onMouseEnter → weer openen) — het
                   submenu knipperde. Padding hoort bij het element zelf, dus
                   de hover blijft ononderbroken binnen de nav. */
                <m.div
                  initial={{ opacity: 0, scale: 0.97, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97, y: -4 }}
                  transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute left-0 top-full z-50 pt-2"
                >
                  <div className="w-72 overflow-hidden rounded-2xl border border-border bg-surface-2 p-1.5 shadow-lg">
                    {entry.items.map((item) => {
                      const a = itemActive(item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setOpen(null)}
                          aria-current={a ? "page" : undefined}
                          className={cn(
                            "group relative block rounded-xl py-2.5 pl-4 pr-3 transition-colors",
                            a
                              ? "bg-accent-soft text-accent"
                              : "text-neutral-700 hover:bg-neutral-100",
                          )}
                        >
                          {/* Accent-rail: groeit bij hover vanuit het midden uit
                            en staat vast aan op het actieve item. Reduced-motion
                            wordt globaal afgevangen (globals.css). */}
                          <span
                            aria-hidden
                            className={cn(
                              "pointer-events-none absolute inset-y-1.5 left-1 w-[3px] origin-center rounded-full bg-accent transition-transform duration-150 ease-out",
                              a
                                ? "scale-y-100"
                                : "scale-y-0 group-hover:scale-y-100",
                            )}
                          />
                          {/* Inhoud schuift als geheel mee, zodat icoon en tekst
                            uitgelijnd blijven. */}
                          <span className="flex items-start gap-3 transition-transform duration-150 ease-out group-hover:translate-x-0.5">
                            {item.iconPath ? (
                              <span
                                className={cn(
                                  "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-150",
                                  a
                                    ? "bg-accent/10 text-accent"
                                    : "bg-neutral-100 text-neutral-500 group-hover:bg-accent-soft group-hover:text-accent",
                                )}
                              >
                                <NavIcon d={item.iconPath} />
                              </span>
                            ) : null}
                            <span className="min-w-0">
                              <span className="block text-sm font-medium leading-tight">
                                {item.label}
                              </span>
                              {item.description ? (
                                <span className="mt-0.5 block text-xs text-neutral-500">
                                  {item.description}
                                </span>
                              ) : null}
                            </span>
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </m.div>
              ) : null}
            </AnimatePresence>
          </div>
        );
      })}
    </nav>
  );
}
