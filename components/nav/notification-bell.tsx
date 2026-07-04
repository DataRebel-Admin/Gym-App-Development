"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { Dropdown } from "@/components/ui/dropdown";
import { Bell } from "@/components/ui/icons";
import type { NotificationItem } from "@/lib/notifications";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/app/account/notification-actions";

const CATEGORY_ICON: Record<string, string> = {
  schemas: "📋",
  security: "🔐",
  invitations: "✉️",
  new_members: "👥",
  changes: "✏️",
  system: "⚙️",
  news: "📣",
};

function relTime(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "zojuist";
  if (min < 60) return `${min} min geleden`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} u geleden`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} d geleden`;
  return new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
}

/**
 * Belletje met ongelezen-teller en een paneel met recente in-app meldingen.
 * Server-gerenderde data komt via props; mutaties (gelezen markeren) gaan via
 * server-actions + `router.refresh()` zodat de teller meteen klopt.
 */
export function NotificationBell({
  unreadCount,
  items,
}: {
  unreadCount: number;
  items: NotificationItem[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function markAll() {
    start(async () => {
      await markAllNotificationsRead();
      router.refresh();
    });
  }

  function openItem(item: NotificationItem) {
    start(async () => {
      if (!item.read) await markNotificationRead(item.id);
      if (item.link) router.push(item.link);
      router.refresh();
    });
  }

  return (
    <Dropdown
      className={cn(
        // Mobiel: volledige-breedte paneel onder de header → nooit afgesneden.
        "fixed! inset-x-2! top-[64px]! mt-0! w-auto",
        // Desktop: normaal onder de bel, rechts uitgelijnd.
        "sm:absolute! sm:inset-x-auto! sm:right-0! sm:top-auto! sm:mt-2! sm:w-80"
      )}
      trigger={({ toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-label={unreadCount > 0 ? `Meldingen (${unreadCount} ongelezen)` : "Meldingen"}
          className="relative flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface-1 text-neutral-700 transition-colors hover:bg-neutral-50 focus-ring"
        >
          <Bell className="size-[18px]" />
          {unreadCount > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold leading-4 text-accent-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </button>
      )}
    >
      {({ close }) => (
        <div className="flex flex-col">
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-sm font-semibold text-neutral-900">Meldingen</span>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={markAll}
                disabled={pending}
                className="text-xs font-medium text-accent hover:underline disabled:opacity-50"
              >
                Alles gelezen
              </button>
            ) : null}
          </div>
          <div className="h-px bg-border" />

          {items.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-neutral-500">
              Je hebt nog geen meldingen.
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {items.map((item) => (
                <li
                  key={item.id}
                  className={cn(
                    "border-b border-neutral-100 last:border-0",
                    !item.read && "bg-accent-soft"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => {
                      openItem(item);
                      close();
                    }}
                    className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-neutral-100/60"
                  >
                    <span className="mt-0.5 text-base" aria-hidden>
                      {CATEGORY_ICON[item.category] ?? "🔔"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block truncate text-sm",
                          item.read ? "font-medium text-neutral-700" : "font-semibold text-neutral-900"
                        )}
                      >
                        {item.title}
                      </span>
                      {item.body ? (
                        <span className="mt-0.5 line-clamp-2 text-xs text-neutral-500">
                          {item.body}
                        </span>
                      ) : null}
                      <span className="mt-0.5 block text-[11px] text-neutral-400">
                        {relTime(item.createdAt)}
                      </span>
                    </span>
                    {!item.read ? (
                      <span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" />
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="h-px bg-border" />
          <Link
            href="/account/meldingen"
            onClick={close}
            className="block px-3 py-2 text-center text-xs font-medium text-neutral-500 transition-colors hover:text-neutral-900"
          >
            Meldingsinstellingen
          </Link>
        </div>
      )}
    </Dropdown>
  );
}
