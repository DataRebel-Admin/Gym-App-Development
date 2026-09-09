"use client";

import Link from "next/link";
import { Dropdown } from "@/components/ui/dropdown";
import { switchTenant } from "@/app/switch-tenant-action";
import type { UserTenant } from "@/lib/tenants";

/**
 * Merkblok linksbovenin de owner-header: logo + naam van de sportschool.
 *
 * Hoort het account bij meerdere sportscholen, dan is de naam zélf de
 * switcher (werkruimte-patroon): klik op de naam → lijst met sportscholen,
 * wisselen zonder herlogin via de switchTenant-action. Het logo blijft de
 * link naar het dashboard.
 *
 * Eerder stond de switcher als losse knop in de nav-rij, mét dezelfde
 * gym-naam nogmaals naast het logo. Die dubbeling duwde op lg-breedte de
 * navigatie onder de knoppen rechts. Nu neemt de switcher de plek van de naam
 * in en kost hij geen extra ruimte.
 */
export function TenantSwitcher({
  tenants,
  currentSlug,
  name,
  logoUrl,
  homeHref,
}: {
  tenants: UserTenant[];
  currentSlug: string | null;
  name: string;
  logoUrl: string | null;
  homeHref: string;
}) {
  const logo = logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logoUrl} alt="" className="h-7 w-7 shrink-0 rounded-md object-contain" />
  ) : (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-accent-gradient text-sm text-accent-foreground">
      {name.charAt(0) || "G"}
    </span>
  );

  const nameClass = "max-w-[14rem] truncate lg:max-w-[9rem] xl:max-w-[14rem]";

  if (tenants.length < 2) {
    return (
      <Link
        href={homeHref}
        className="flex min-w-0 items-center gap-2 font-display text-lg font-bold text-neutral-900"
      >
        {logo}
        <span className={nameClass}>{name}</span>
      </Link>
    );
  }

  const current = tenants.find((t) => t.slug === currentSlug);
  const label = current?.name ?? name;

  return (
    <div className="flex min-w-0 items-center gap-2">
      <Link href={homeHref} className="shrink-0 rounded-md focus-ring" aria-label="Dashboard">
        {logo}
      </Link>
      <Dropdown
        align="start"
        className="min-w-56"
        trigger={({ open, toggle }) => (
          <button
            type="button"
            onClick={toggle}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label="Wissel van sportschool"
            title="Wissel van sportschool"
            className="flex min-w-0 items-center gap-1 rounded-lg py-1 pr-1.5 pl-1 -ml-1 font-display text-lg font-bold text-neutral-900 transition-colors hover:bg-neutral-100/70 focus-ring"
          >
            <span className={nameClass}>{label}</span>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              className={`size-3.5 shrink-0 text-neutral-400 transition-transform ${open ? "rotate-180" : ""}`}
              aria-hidden
            >
              <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      >
        {() => (
          <>
            <p className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-neutral-400">
              Wissel van sportschool
            </p>
            {tenants.map((t) => {
              const active = t.slug === currentSlug;
              return (
                <form key={t.id} action={switchTenant}>
                  <input type="hidden" name="slug" value={t.slug} />
                  <button
                    type="submit"
                    disabled={active}
                    className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      active
                        ? "bg-accent-soft text-accent"
                        : "text-neutral-700 hover:bg-neutral-100"
                    }`}
                  >
                    <span className="truncate">{t.name}</span>
                    {active ? <span aria-hidden>✓</span> : null}
                  </button>
                </form>
              );
            })}
          </>
        )}
      </Dropdown>
    </div>
  );
}
