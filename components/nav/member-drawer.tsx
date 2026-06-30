"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Menu } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { logout } from "@/app/login/actions";
import { switchTenant } from "@/app/switch-tenant-action";
import { ThemeToggle } from "@/components/theme-toggle";
import { Dumbbell, Settings, LogOut, X, Check, ChevronRight, Activity } from "@/components/ui/icons";
import type { UserTenant } from "@/lib/tenants";

/**
 * Mobiel-vriendelijke zijwaartse uitklap-drawer voor de member-area. Vervangt de
 * drukke header-knoppenrij: één hamburger opent een paneel met profiel, snelle
 * links (oefeningenbibliotheek, account), sportschool-wisselaar, thema en uitloggen.
 */
export function MemberDrawer({
  name,
  email,
  image,
  tenants,
  currentSlug,
}: {
  name: string | null;
  email: string | null;
  image: string | null;
  tenants: UserTenant[];
  currentSlug: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const display = name ?? email ?? "Sporter";
  const initial = display.charAt(0).toUpperCase();

  // Pas na mount portalen (document beschikbaar; voorkomt SSR-mismatch).
  useEffect(() => setMounted(true), []);

  // Scroll vergrendelen + Escape sluit het paneel.
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

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Menu openen"
        aria-expanded={open}
        className="flex size-9 items-center justify-center rounded-xl border border-border bg-surface-1 text-neutral-700 transition-colors hover:text-neutral-900 focus-ring"
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
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-y-0 right-0 flex w-[82%] max-w-xs flex-col overflow-y-auto border-l border-border bg-surface-1 pb-[env(safe-area-inset-bottom)] shadow-2xl"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Menu"
            >
              {/* Kop */}
              <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
                <span className="text-sm font-semibold text-neutral-500">Menu</span>
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
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={image} alt="" className="size-full object-cover" />
                  ) : (
                    initial
                  )}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-display font-bold text-neutral-900">
                    {name ?? "Sporter"}
                  </p>
                  {email ? (
                    <p className="truncate text-xs text-neutral-500">{email}</p>
                  ) : null}
                </div>
              </div>

              {/* Snelle links */}
              <nav className="flex flex-col gap-1 px-2.5">
                <DrawerLink href="/member/exercises" icon={<Dumbbell className="size-5" />} onClick={() => setOpen(false)}>
                  Oefeningenbibliotheek
                </DrawerLink>
                <DrawerLink href="/member/progress" icon={<Activity className="size-5" />} onClick={() => setOpen(false)}>
                  Mijn voortgang
                </DrawerLink>
                <DrawerLink href="/account" icon={<Settings className="size-5" />} onClick={() => setOpen(false)}>
                  Accountinstellingen
                </DrawerLink>
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
                            className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
                              active
                                ? "border-accent/40 bg-accent-soft text-accent"
                                : "border-border bg-surface-0 text-neutral-700 hover:bg-surface-2"
                            }`}
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

              {/* Thema */}
              <div className="mt-4 flex items-center justify-between px-4">
                <span className="text-sm font-medium text-neutral-700">Donker / licht thema</span>
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
    </>
  );
}

function DrawerLink({
  href,
  icon,
  children,
  onClick,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-neutral-800 transition-colors hover:bg-surface-2"
    >
      <span className="text-accent">{icon}</span>
      <span className="flex-1">{children}</span>
      <ChevronRight className="size-4 text-neutral-300" />
    </Link>
  );
}
