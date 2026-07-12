import Link from "next/link";
import type { AccountGroup } from "@/lib/account-sections";

function TileIcon({ path }: { path: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5"
      aria-hidden
    >
      <path d={path} />
    </svg>
  );
}

function Chevron() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5 shrink-0 text-neutral-300 lg:hidden"
      aria-hidden
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

/**
 * Settings-hub: mobiel een native gegroepeerde lijst (grote tap-rijen +
 * chevron), desktop een overzicht-grid naast de zijbalk. Puur presentational —
 * de layout resolvet de labels en geeft geserialiseerde groepen door.
 */
export function AccountHub({ title, groups }: { title: string; groups: AccountGroup[] }) {
  return (
    <div className="flex flex-col gap-7">
      {/* Op mobiel toont de topbalk de titel al; op desktop een kop boven het overzicht. */}
      <h1 className="hidden font-display text-2xl font-bold text-neutral-900 lg:block">{title}</h1>

      {groups.map((group) => (
        <section key={group.key} className="flex flex-col gap-2">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">
            {group.label}
          </h2>
          <div className="divide-y divide-neutral-100 overflow-hidden rounded-2xl border border-border bg-surface-1 md:grid md:grid-cols-2 md:gap-3 md:divide-y-0 md:overflow-visible md:rounded-none md:border-0 md:bg-transparent">
            {group.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex min-h-[3.5rem] items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-neutral-50 active:bg-neutral-100 md:rounded-2xl md:border md:border-border md:bg-surface-1 md:py-4 md:hover:bg-surface-1 md:hover:shadow-sm"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                  <TileIcon path={item.iconPath} />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm font-semibold text-neutral-900">{item.label}</span>
                  <span className="truncate text-xs text-neutral-500">{item.desc}</span>
                </span>
                <Chevron />
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
