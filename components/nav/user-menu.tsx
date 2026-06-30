"use client";

import Link from "next/link";
import { logout } from "@/app/login/actions";
import { Dropdown, DropdownItem } from "@/components/ui/dropdown";

/** Avatar-initiaal + dropdown met gebruikersinfo en uitloggen. */
export function UserMenu({
  name,
  email,
}: {
  name: string | null;
  email: string | null;
}) {
  const display = name ?? email ?? "Gebruiker";
  const initial = display.charAt(0).toUpperCase();

  return (
    <Dropdown
      trigger={({ toggle }) => (
        <button
          type="button"
          onClick={toggle}
          className="flex items-center gap-2 rounded-full border border-border bg-surface-1 py-1 pl-1 pr-3 transition-colors hover:bg-neutral-50 focus-ring"
        >
          <span className="flex size-7 items-center justify-center rounded-full bg-accent-gradient text-xs font-bold text-accent-foreground">
            {initial}
          </span>
          <span className="max-w-[10rem] truncate text-sm font-medium text-neutral-700">
            {display}
          </span>
        </button>
      )}
    >
      {() => (
        <>
          <div className="px-3 py-2">
            <p className="truncate text-sm font-semibold text-neutral-900">
              {name ?? "Gebruiker"}
            </p>
            {email ? (
              <p className="truncate text-xs text-neutral-500">{email}</p>
            ) : null}
          </div>
          <div className="my-1 h-px bg-border" />
          <Link
            href="/account"
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-neutral-700 transition-colors hover:bg-neutral-100"
          >
            Accountinstellingen
          </Link>
          <div className="my-1 h-px bg-border" />
          <form action={logout}>
            <DropdownItem type="submit" className="text-red-600 hover:bg-red-50">
              Uitloggen
            </DropdownItem>
          </form>
        </>
      )}
    </Dropdown>
  );
}
