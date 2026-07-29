import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * URL-gedreven tab-rij (Link-navigatie via searchParams — deelbaar, werkt
 * zonder JS). Bewust níet ui/tabs.tsx: dat is een controlled client component.
 */
export function LinkTabs({
  items,
  className,
}: {
  items: { href: string; label: string; active: boolean }[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap gap-1 rounded-xl border border-border bg-surface-0 p-1 text-sm",
        className
      )}
    >
      {items.map((it) => (
        <Link
          key={it.href}
          href={it.href}
          className={cn(
            "rounded-lg px-3 py-1 font-medium transition-colors",
            it.active
              ? "bg-surface-1 text-neutral-900 shadow-sm"
              : "text-neutral-500 hover:text-neutral-900"
          )}
        >
          {it.label}
        </Link>
      ))}
    </div>
  );
}
