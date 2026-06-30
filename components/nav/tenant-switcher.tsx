"use client";

import { Dropdown } from "@/components/ui/dropdown";
import { switchTenant } from "@/app/switch-tenant-action";
import type { UserTenant } from "@/lib/tenants";

/**
 * Tenant-switcher (linksbovenin) voor accounts die bij meerdere sportscholen
 * horen. Wisselt zonder herlogin via de switchTenant-action.
 */
export function TenantSwitcher({
  tenants,
  currentSlug,
}: {
  tenants: UserTenant[];
  currentSlug: string | null;
}) {
  if (tenants.length < 2) return null;
  const current = tenants.find((t) => t.slug === currentSlug) ?? tenants[0];

  return (
    <Dropdown
      align="start"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-1 px-2.5 py-1.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 focus-ring"
          aria-label="Wissel van sportschool"
        >
          <span className="max-w-[9rem] truncate">{current.name}</span>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
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
  );
}
