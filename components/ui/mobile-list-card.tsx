import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * Mobiele lijst-kaart: de stapel-weergave van een tabelrij op kleine schermen
 * (hybride aanpak — desktop houdt de tabel, mobiel toont kaarten). Server-
 * compatibel; met `href` is de hele kaart een link (duim-vriendelijk doelwit).
 *
 * Gebruik samen met `hidden md:block` op de <TableWrap> en `md:hidden` op de
 * kaartenlijst, zodat dezelfde data in beide vormen wordt getoond.
 */
export function MobileListCard({
  href,
  className,
  children,
}: {
  href?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const base = cn(
    "block rounded-2xl border border-border bg-surface-1 p-4 shadow-sm",
    href && "transition-colors hover:border-border-strong hover:bg-neutral-100/60 focus-ring",
    className
  );
  if (href) {
    return (
      <Link href={href} className={base}>
        {children}
      </Link>
    );
  }
  return <div className={base}>{children}</div>;
}

/** Label/waarde-regel binnen een MobileListCard. */
export function MobileListRow({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3 text-sm", className)}>
      <span className="shrink-0 text-neutral-500">{label}</span>
      <span className="min-w-0 truncate text-right text-neutral-900">{children}</span>
    </div>
  );
}
