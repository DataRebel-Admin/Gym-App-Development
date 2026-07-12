"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type FlatItem = { href: string; label: string };

/**
 * Contextuele account-topbalk. Terug-pijl + dynamische titel worden afgeleid uit
 * het pad zodat de accountsectie als een native hub-en-detail voelt:
 *  - op de hub (`/account`) → titel = app-titel, terug → rol-dashboard;
 *  - op een sub-pagina → titel = sectienaam, terug → de hub (native "up").
 * De titel toont alleen op mobiel (`lg:hidden`); op desktop geeft de zijbalk +
 * content-kop de context. `children` = de server-gerenderde <UserMenu>.
 */
export function AccountHeaderNav({
  flat,
  rootTitle,
  rootHref,
  dashboardHref,
  backLabel,
  children,
}: {
  flat: FlatItem[];
  rootTitle: string;
  rootHref: string;
  dashboardHref: string;
  backLabel: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const onRoot = pathname === rootHref;

  const current = onRoot
    ? null
    : flat.find(
        (it) => it.href !== rootHref && (pathname === it.href || pathname.startsWith(it.href + "/"))
      );

  const title = onRoot ? rootTitle : current?.label ?? rootTitle;
  const backHref = onRoot ? dashboardHref : rootHref;

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
      <div className="justify-self-start">
        <Link
          href={backHref}
          aria-label={backLabel}
          className="-ml-2 flex h-10 items-center gap-1.5 rounded-xl px-2 text-sm font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-5 shrink-0"
            aria-hidden
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          <span className="hidden sm:inline">{backLabel}</span>
        </Link>
      </div>

      <span className="justify-self-center truncate px-1 font-display text-base font-bold text-neutral-900 lg:hidden">
        {title}
      </span>

      <div className="justify-self-end">{children}</div>
    </div>
  );
}
