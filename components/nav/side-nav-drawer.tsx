"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { cn } from "@/lib/cn";
import { logout } from "@/app/login/actions";
import { switchTenant } from "@/app/switch-tenant-action";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogOut, Settings, X, Check, ChevronRight, LifeBuoy } from "@/components/ui/icons";
import type { OwnerNavEntry } from "@/components/nav/owner-nav";
import type { UserTenant } from "@/lib/tenants";
import {
  ContactSupportModal,
  type SupportInitial,
} from "@/components/support/contact-support-modal";

/**
 * Links-inschuivend hamburger-zijmenu voor de beheeromgevingen (Superadmin +
 * Tenant Owner). Gemodelleerd op components/nav/member-drawer.tsx (portal,
 * scroll-lock, Escape) maar vanaf links en met de gegroepeerde navigatiestructuur
 * (`OwnerNavEntry`) zodat zowel losse links (admin) als groepen (owner) passen.
 *
 * Toont alleen de hamburger; de drawer zelf opent in een portal. Sluit
 * automatisch na navigatie. Wordt door de layout in `lg:hidden` gezet, zodat de
 * bestaande desktop-navigatie op grote schermen ongewijzigd blijft.
 */
export function SideNavDrawer({
  entries,
  rootHref,
  brand,
  profile,
  tenants = [],
  currentSlug = null,
  accountHref = "/account",
  support,
  className,
}: {
  entries: OwnerNavEntry[];
  rootHref: string;
  brand: { name: string; logoUrl: string | null };
  profile: { name: string | null; email: string | null; image: string | null };
  tenants?: UserTenant[];
  currentSlug?: string | null;
  accountHref?: string;
  /** Aanwezig voor tenant-gebruikers → toont "Contact opnemen" (opent modal). */
  support?: SupportInitial | null;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const pathname = usePathname();

  const display = profile.name ?? profile.email ?? "Beheerder";
  const initial = display.charAt(0).toUpperCase();

  useEffect(() => setMounted(true), []);

  // Scroll vergrendelen + Escape sluit.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const itemActive = (href: string) =>
    href === rootHref
      ? pathname === rootHref
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Menu openen"
        aria-expanded={open}
        className={cn(
          "flex size-9 items-center justify-center rounded-xl border border-border bg-surface-1 text-neutral-700 transition-colors hover:text-neutral-900 focus-ring",
          className
        )}
      >
        <Menu className="size-[18px]" />
      </button>

      {mounted
        ? createPortal(
            <AnimatePresence>
              {open ? (
                <m.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm"
                  onClick={() => setOpen(false)}
                >
                  <m.aside
                    initial={{ x: "-100%" }}
                    animate={{ x: 0 }}
                    exit={{ x: "-100%" }}
                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute inset-y-0 left-0 flex w-[84%] max-w-xs flex-col overflow-y-auto border-r border-border bg-surface-1 pb-[env(safe-area-inset-bottom)] shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Menu"
                  >
                    {/* Kop met merk */}
                    <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
                      <Link
                        href={rootHref}
                        onClick={() => setOpen(false)}
                        className="flex min-w-0 items-center gap-2 font-display font-bold text-neutral-900"
                      >
                        {brand.logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={brand.logoUrl}
                            alt=""
                            className="size-7 shrink-0 rounded-md object-contain"
                          />
                        ) : (
                          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-accent-gradient text-xs text-accent-foreground">
                            {brand.name.charAt(0)}
                          </span>
                        )}
                        <span className="truncate">{brand.name}</span>
                      </Link>
                      <button
                        type="button"
                        onClick={() => setOpen(false)}
                        aria-label="Menu sluiten"
                        className="flex size-9 items-center justify-center rounded-xl text-neutral-500 transition-colors hover:bg-surface-2 hover:text-neutral-900 focus-ring"
                      >
                        <X className="size-5" />
                      </button>
                    </div>

                    {/* Profiel */}
                    <div className="flex items-center gap-3 px-4 py-4">
                      <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-gradient text-base font-bold text-accent-foreground">
                        {profile.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={profile.image} alt="" className="size-full object-cover" />
                        ) : (
                          initial
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-display font-bold text-neutral-900">
                          {profile.name ?? "Beheerder"}
                        </p>
                        {profile.email ? (
                          <p className="truncate text-xs text-neutral-500">{profile.email}</p>
                        ) : null}
                      </div>
                    </div>

                    {/* Navigatie */}
                    <nav className="flex flex-col gap-0.5 px-2.5">
                      {entries.map((entry) =>
                        entry.type === "link" ? (
                          <DrawerLink
                            key={entry.href}
                            href={entry.href}
                            iconPath={entry.iconPath}
                            active={itemActive(entry.href)}
                            onClick={() => setOpen(false)}
                          >
                            {entry.label}
                          </DrawerLink>
                        ) : (
                          <div key={entry.key} className="mt-3 first:mt-0">
                            <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wide text-neutral-400">
                              {entry.label}
                            </p>
                            {entry.items.map((item) => (
                              <DrawerLink
                                key={item.href}
                                href={item.href}
                                iconPath={item.iconPath}
                                active={itemActive(item.href)}
                                onClick={() => setOpen(false)}
                              >
                                {item.label}
                              </DrawerLink>
                            ))}
                          </div>
                        )
                      )}
                    </nav>

                    {/* Sportschool wisselen */}
                    {tenants.length >= 2 ? (
                      <div className="mt-4 px-4">
                        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-neutral-400">
                          Sportschool
                        </p>
                        <div className="flex flex-col gap-1.5">
                          {tenants.map((t) => {
                            const active = t.slug === currentSlug;
                            return (
                              <form key={t.id} action={switchTenant}>
                                <input type="hidden" name="slug" value={t.slug} />
                                <button
                                  type="submit"
                                  disabled={active}
                                  className={cn(
                                    "flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
                                    active
                                      ? "border-accent/40 bg-accent-soft text-accent"
                                      : "border-border bg-surface-0 text-neutral-700 hover:bg-surface-2"
                                  )}
                                >
                                  <span className="truncate font-medium">{t.name}</span>
                                  {active ? <Check className="size-4 shrink-0" /> : null}
                                </button>
                              </form>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}

                    {/* Account + thema */}
                    <div className="mt-4 flex flex-col gap-0.5 px-2.5">
                      <Link
                        href={accountHref}
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-neutral-800 transition-colors hover:bg-surface-2"
                      >
                        <Settings className="size-5 text-accent" />
                        <span className="flex-1">Accountinstellingen</span>
                        <ChevronRight className="size-4 text-neutral-300" />
                      </Link>
                      {support ? (
                        <button
                          type="button"
                          onClick={() => {
                            setOpen(false);
                            setSupportOpen(true);
                          }}
                          className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-neutral-800 transition-colors hover:bg-surface-2"
                        >
                          <LifeBuoy className="size-5 text-accent" />
                          <span className="flex-1 text-left">Contact opnemen</span>
                          <ChevronRight className="size-4 text-neutral-300" />
                        </button>
                      ) : null}
                    </div>
                    <div className="mt-1 flex items-center justify-between px-4 py-2">
                      <span className="text-sm font-medium text-neutral-700">
                        Donker / licht thema
                      </span>
                      <ThemeToggle />
                    </div>

                    <div className="mt-auto px-2.5 pb-4 pt-6">
                      <form action={logout}>
                        <button
                          type="submit"
                          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-red-600 transition-colors hover:bg-red-500/10"
                        >
                          <LogOut className="size-5" /> Uitloggen
                        </button>
                      </form>
                    </div>
                  </m.aside>
                </m.div>
              ) : null}
            </AnimatePresence>,
            document.body
          )
        : null}
      {support ? (
        <ContactSupportModal
          open={supportOpen}
          onClose={() => setSupportOpen(false)}
          initial={support}
        />
      ) : null}
    </>
  );
}

function NavIcon({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5 shrink-0"
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}

function DrawerLink({
  href,
  iconPath,
  active,
  onClick,
  children,
}: {
  href: string;
  iconPath?: string;
  active: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors",
        active
          ? "bg-accent-soft text-accent"
          : "text-neutral-800 hover:bg-surface-2"
      )}
    >
      <span className={active ? "text-accent" : "text-neutral-500"}>
        {iconPath ? <NavIcon d={iconPath} /> : null}
      </span>
      <span className="flex-1">{children}</span>
    </Link>
  );
}
