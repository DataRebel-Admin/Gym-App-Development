"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { logout } from "@/app/login/actions";
import { Dropdown, DropdownItem } from "@/components/ui/dropdown";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { LifeBuoy } from "@/components/ui/icons";
import {
  ContactSupportModal,
  type SupportInitial,
} from "@/components/support/contact-support-modal";

/** Avatar (foto of initiaal) + dropdown met gebruikersinfo en uitloggen. */
export function UserMenu({
  name,
  email,
  image,
  support,
  compact = false,
}: {
  name: string | null;
  email: string | null;
  image?: string | null;
  /** Aanwezig voor tenant-gebruikers → toont "Contact opnemen" (opent modal). */
  support?: SupportInitial | null;
  /** Verbergt de naam-tekst onder 2xl (alleen avatar) — voor drukke headers
   *  (owner: bel + switcher + badge concurreren om ruimte). */
  compact?: boolean;
}) {
  const t = useTranslations("nav.userMenu");
  const tLang = useTranslations("account.language");
  const display = name ?? email ?? t("fallbackName");
  const initial = display.charAt(0).toUpperCase();
  const [supportOpen, setSupportOpen] = useState(false);

  return (
    <>
    <Dropdown
      trigger={({ toggle }) => (
        <button
          type="button"
          onClick={toggle}
          className="flex items-center gap-2 rounded-full border border-border bg-surface-1 py-1 pl-1 pr-3 transition-colors hover:bg-neutral-50 focus-ring"
        >
          <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-gradient text-xs font-bold text-accent-foreground">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt="" className="size-full object-cover" />
            ) : (
              initial
            )}
          </span>
          <span
            className={cn(
              "max-w-[10rem] truncate text-sm font-medium text-neutral-700",
              // Header-inhoud is gecapt op max-w-7xl (1280px) → breder scherm geeft
              // geen extra ruimte. Bij een drukke header (owner) daarom de naam
              // altijd verbergen (staat in het dropdown-menu), niet pas vanaf 2xl.
              compact && "hidden"
            )}
          >
            {display}
          </span>
        </button>
      )}
    >
      {({ close }) => (
        <>
          <div className="flex items-center gap-2.5 px-3 py-2">
            <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-gradient text-sm font-bold text-accent-foreground">
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={image} alt="" className="size-full object-cover" />
              ) : (
                initial
              )}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-neutral-900">
                {name ?? t("fallbackName")}
              </p>
              {email ? (
                <p className="truncate text-xs text-neutral-500">{email}</p>
              ) : null}
            </div>
          </div>
          <div className="my-1 h-px bg-border" />
          <Link
            href="/account"
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-neutral-700 transition-colors hover:bg-neutral-100"
          >
            {t("account")}
          </Link>
          {support ? (
            <DropdownItem
              onClick={() => {
                close();
                setSupportOpen(true);
              }}
            >
              <LifeBuoy size={16} className="text-neutral-500" />
              {t("support")}
            </DropdownItem>
          ) : null}
          <div className="my-1 h-px bg-border" />
          <div className="px-1 pb-1">
            <p className="px-2 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wide text-neutral-400">
              {tLang("navLabel")}
            </p>
            <LanguageSwitcher variant="menu" />
          </div>
          <div className="my-1 h-px bg-border" />
          <form action={logout}>
            <DropdownItem type="submit" className="text-red-600 hover:bg-red-50">
              {t("logout")}
            </DropdownItem>
          </form>
        </>
      )}
    </Dropdown>
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
