import Link from "next/link";
import { cn } from "@/lib/cn";

/** Tab-balk op het ledenprofiel: Profiel | Voortgang & Metingen | Coachnotities.
 *  Tabs respecteren de permissies van de bekijker (medewerker ziet alleen wat mag). */
export function MemberProfileTabs({
  userId,
  active,
  canMeasure = true,
  canNotes = true,
}: {
  userId: string;
  active: "profiel" | "progress" | "notes";
  canMeasure?: boolean;
  canNotes?: boolean;
}) {
  const tabs = [
    { key: "profiel", label: "Profiel", href: `/owner/members/${userId}`, show: true },
    {
      key: "progress",
      label: "Voortgang & Metingen",
      href: `/owner/members/${userId}/progress`,
      show: canMeasure,
    },
    {
      key: "notes",
      label: "Coachnotities",
      href: `/owner/members/${userId}/notes`,
      show: canNotes,
    },
  ].filter((t) => t.show);
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
