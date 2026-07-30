"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Menu } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { cn } from "@/lib/cn";
import { logout } from "@/app/login/actions";
import { switchTenant } from "@/app/switch-tenant-action";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { Dumbbell, Settings, LogOut, X, Check, ChevronRight, ChevronDown, Activity, Building2, ClipboardList, Pencil, PersonStanding, Trophy, Flag, Wrench, LifeBuoy, Sparkles } from "@/components/ui/icons";
import { parseRequestKind, requestKindHref } from "@/lib/schema-requests";
import { ReportProblemModal } from "@/components/reports/report-problem-modal";
import { reopenOnboarding } from "@/components/member/onboarding";
import { useHydrated } from "@/lib/hooks/use-client-value";
import type { UserTenant } from "@/lib/tenants";

/**
 * Eén regel per menu-ingang: een link (`href`) óf een actie (`onSelect`, bv. een
 * modal). Zo passen "Probleem melden" en "Rondleiding" in dezelfde groepen als
 * de navigatielinks.
 */
type DrawerItem = {
  key: string;
  label: string;
  icon: React.ReactNode;
  href?: string;
  onSelect?: () => void;
  /** Overschrijft de active-state (voor ingangen die alleen in de query verschillen). */
  active?: boolean;
};

/**
 * Mobiel-vriendelijke zijwaartse uitklap-drawer voor de member-area. Vervangt de
 * drukke header-knoppenrij: één hamburger opent een paneel met profiel, de
 * gegroepeerde menu-ingangen, sportschool-wisselaar, thema en uitloggen.
 *
 * De ingangen staan bewust **gegroepeerd** (Trainen / Voortgang / Sportschool /
 * Instellingen / Hulp) i.p.v. als één lange lijst — zelfde groep-idioom als de
 * owner-drawer (`components/nav/side-nav-drawer.tsx`): een kleine hoofdletter-kop
 * per groep. Nieuwe ingang = één record in de juiste `groups`-entry hieronder.
 */
export function MemberDrawer({
  name,
  email,
  image,
  tenants,
  currentSlug,
  showAchievements = false,
  showSchemaBuilder = false,
  showSchemaChange = false,
}: {
  name: string | null;
  email: string | null;
  image: string | null;
  tenants: UserTenant[];
  currentSlug: string | null;
  showAchievements?: boolean;
  showSchemaBuilder?: boolean;
  /** Er ligt een actief coach-schema → "Aanpassing vragen" is zinvol. */
  showSchemaChange?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  // Pas na mount portalen (document beschikbaar; voorkomt SSR-mismatch).
  const mounted = useHydrated();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const display = name ?? email ?? "Sporter";
  const initial = display.charAt(0).toUpperCase();

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

  const itemActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  // De twee aanvraag-ingangen delen één pad en verschillen alleen in `?type=`;
  // zonder deze splitsing zouden ze samen oplichten.
  const onRequests = pathname === "/member/requests";
  const changeActive = onRequests && parseRequestKind(searchParams.get("type")) === "CHANGE";

  // Menu-ingangen per groep. `false`-items vallen weg (tenant-/lid-afhankelijk).
  const groups: { key: string; label: string; items: DrawerItem[] }[] = [
    {
      key: "training",
      label: "Trainen",
      items: [
        {
          key: "requests",
          label: "Trainingsschema aanvragen",
          icon: <ClipboardList className="size-5" />,
          href: "/member/requests",
          active: onRequests && !changeActive,
        },
        // Aanpassing vragen is een ánder verzoek dan een nieuw schema (eigen
        // formulier + eigen coach-actie), dus een eigen ingang — alleen zichtbaar
        // als er een coach-schema ligt om aan te passen.
        ...(showSchemaChange
          ? [
              {
                key: "requestChange",
                label: "Aanpassing vragen",
                icon: <Sparkles className="size-5" />,
                href: requestKindHref("CHANGE"),
                active: changeActive,
              },
            ]
          : []),
        ...(showSchemaBuilder
          ? [
              {
                key: "builder",
                label: "Zelf schema samenstellen",
                icon: <Pencil className="size-5" />,
                href: "/member/schema/builder",
              },
            ]
          : []),
        {
          key: "exercises",
          label: "Oefeningenbibliotheek",
          icon: <Dumbbell className="size-5" />,
          href: "/member/exercises",
        },
      ],
    },
    {
      key: "progress",
      label: "Voortgang",
      items: [
        {
          key: "progress",
          label: "Mijn voortgang",
          icon: <Activity className="size-5" />,
          href: "/member/progress",
        },
        {
          key: "muscles",
          label: "Spieranalyse",
          icon: <PersonStanding className="size-5" />,
          href: "/member/muscles",
        },
        ...(showAchievements
          ? [
              {
                key: "trophies",
                label: "Trofeeën",
                icon: <Trophy className="size-5" />,
                href: "/member/trophies",
              },
            ]
          : []),
      ],
    },
    {
      key: "gym",
      label: "Sportschool",
      items: [
        {
          key: "gym",
          label: "Mijn sportschool",
          icon: <Building2 className="size-5" />,
          href: "/member/gym",
        },
        {
          key: "defects",
          label: "Apparaatdefect melden",
          icon: <Wrench className="size-5" />,
          href: "/member/defects",
        },
      ],
    },
  ];

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

              {/* Gegroepeerde menu-ingangen */}
              <nav className="flex flex-col px-2.5">
                {groups.map((group) => (
                  <DrawerGroup key={group.key} label={group.label}>
                    {group.items.map((item) => (
                      <DrawerRow
                        key={item.key}
                        item={item}
                        active={item.active ?? (item.href ? itemActive(item.href) : false)}
                        onNavigate={() => setOpen(false)}
                      />
                    ))}
                  </DrawerGroup>
                ))}

                {/* Instellingen: account-link + de keuzes die geen pagina zijn
                    (sportschool wisselen, taal, thema) staan bewust in dezelfde
                    groep zodat het menu één scanbare kolom blijft. */}
                <DrawerGroup label="Instellingen">
                  <DrawerRow
                    item={{
                      key: "account",
                      label: "Accountinstellingen",
                      icon: <Settings className="size-5" />,
                      href: "/account",
                    }}
                    active={itemActive("/account")}
                    onNavigate={() => setOpen(false)}
                  />
                  {tenants.length >= 2 ? (
                    <div className="px-3 pb-1 pt-1.5">
                      <p className="mb-1.5 text-xs font-medium text-neutral-500">
                        Sportschool wisselen
                      </p>
                      <TenantDropdown tenants={tenants} currentSlug={currentSlug} />
                    </div>
                  ) : null}
                  <div className="px-3 pb-1 pt-1.5">
                    <p className="mb-1.5 text-xs font-medium text-neutral-500">Taal</p>
                    <LanguageSwitcher variant="dropdown" />
                  </div>
                  <div className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="text-sm font-medium text-neutral-800">
                      Donker / licht thema
                    </span>
                    <ThemeToggle />
                  </div>
                </DrawerGroup>

                <DrawerGroup label="Hulp">
                  <DrawerRow
                    item={{
                      key: "report",
                      label: "Probleem melden",
                      icon: <Flag className="size-5" />,
                      onSelect: () => setReportOpen(true),
                    }}
                    active={false}
                    onNavigate={() => setOpen(false)}
                  />
                  <DrawerRow
                    item={{
                      key: "tour",
                      label: "Rondleiding opnieuw bekijken",
                      icon: <LifeBuoy className="size-5" />,
                      onSelect: reopenOnboarding,
                    }}
                    active={false}
                    onNavigate={() => setOpen(false)}
                  />
                </DrawerGroup>
              </nav>

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
      <ReportProblemModal open={reportOpen} onClose={() => setReportOpen(false)} />
    </>
  );
}

/**
 * Uitklapbare sportschool-keuze: een knop toont de actieve sportschool; klikken
 * vouwt de rest uit. Elke keuze submit `switchTenant`. Sluit bij klik-buiten en
 * Escape — visueel gelijk aan de taal-dropdown erboven.
 */
function TenantDropdown({
  tenants,
  currentSlug,
}: {
  tenants: UserTenant[];
  currentSlug: string | null;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const activeName =
    tenants.find((t) => t.slug === currentSlug)?.name ?? tenants[0]?.name ?? "—";

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex w-full items-center gap-2.5 rounded-lg border border-border bg-surface-1 px-3 py-2 text-left text-sm text-neutral-700 transition-colors hover:bg-neutral-100 ${
          open ? "bg-neutral-100" : ""
        }`}
      >
        <Building2 className="size-4 text-accent" />
        <span className="flex-1 truncate font-medium">{activeName}</span>
        <ChevronDown
          className={`size-4 text-neutral-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {open ? (
          <m.ul
            role="listbox"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-full z-10 mt-1.5 w-full overflow-hidden rounded-lg border border-border bg-surface-1 p-0.5 shadow-lg"
          >
            {tenants.map((t) => {
              const active = t.slug === currentSlug;
              return (
                <li key={t.id} role="option" aria-selected={active}>
                  <form action={switchTenant}>
                    <input type="hidden" name="slug" value={t.slug} />
                    <button
                      type="submit"
                      disabled={active}
                      onClick={() => setOpen(false)}
                      className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors ${
                        active
                          ? "font-medium text-accent"
                          : "text-neutral-700 hover:bg-neutral-100"
                      }`}
                    >
                      <span className="flex-1 truncate">{t.name}</span>
                      {active ? <Check className="size-4 shrink-0" /> : null}
                    </button>
                  </form>
                </li>
              );
            })}
          </m.ul>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/** Groepskop + rijen; zelfde kop-stijl als de owner-drawer. */
function DrawerGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-3.5 first:mt-0">
      <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wide text-neutral-400">
        {label}
      </p>
      {children}
    </div>
  );
}

/**
 * Eén menu-regel: `Link` bij een `href`, anders een knop die de actie uitvoert.
 * Sluit in beide gevallen de drawer via `onNavigate`.
 */
function DrawerRow({
  item,
  active,
  onNavigate,
}: {
  item: DrawerItem;
  active: boolean;
  onNavigate: () => void;
}) {
  const className = cn(
    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors",
    active ? "bg-accent-soft text-accent" : "text-neutral-800 hover:bg-surface-2"
  );

  if (item.href) {
    return (
      <Link
        href={item.href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={className}
      >
        <span className="text-accent">{item.icon}</span>
        <span className="flex-1">{item.label}</span>
        <ChevronRight className="size-4 text-neutral-300" />
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        onNavigate();
        item.onSelect?.();
      }}
      className={className}
    >
      <span className="text-accent">{item.icon}</span>
      <span className="flex-1">{item.label}</span>
      <ChevronRight className="size-4 text-neutral-300" />
    </button>
  );
}
