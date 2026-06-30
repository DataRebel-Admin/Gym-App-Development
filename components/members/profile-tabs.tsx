import Link from "next/link";
import { cn } from "@/lib/cn";

/** Tab-balk op het ledenprofiel: Profiel | Voortgang & Metingen. */
export function MemberProfileTabs({
  userId,
  active,
}: {
  userId: string;
  active: "profiel" | "progress";
}) {
  const tabs = [
    { key: "profiel", label: "Profiel", href: `/owner/members/${userId}` },
    { key: "progress", label: "Voortgang & Metingen", href: `/owner/members/${userId}/progress` },
  ] as const;
  return (
    <div className="flex w-fit gap-1 rounded-xl border border-border bg-surface-1 p-1">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={cn(
            "rounded-lg px-4 py-1.5 text-sm font-medium transition-colors",
            active === t.key
              ? "bg-accent text-accent-foreground shadow-sm"
              : "text-neutral-600 hover:text-neutral-900"
          )}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
