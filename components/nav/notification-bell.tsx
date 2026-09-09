"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useReducedMotion } from "motion/react";
import { cn } from "@/lib/cn";
import { Dropdown } from "@/components/ui/dropdown";
import { Bell, Trash2, X } from "@/components/ui/icons";
import type { NotificationItem } from "@/lib/notifications";
import {
  dismissAllNotifications,
  dismissNotification,
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

/** Sleepafstand waarna loslaten de melding wegveegt. */
const SWIPE_THRESHOLD_PX = 88;
/** Beweging waarboven we de richting (horizontaal of verticaal) vastleggen. */
const AXIS_LOCK_PX = 8;
/** Duur van de wegglij-animatie voordat de rij uit de lijst valt. */
const LEAVE_MS = 180;

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
 * Eén melding in het paneel. Met een vinger veeg je de rij naar links of rechts
 * weg; met muis of toetsenbord doet het kruisje hetzelfde. Slepen met de muis
 * laten we bewust met rust, dat botst met gewoon klikken en tekstselectie.
 */
function NotificationRow({
  item,
  onOpen,
  onDismiss,
}: {
  item: NotificationItem;
  onOpen: () => void;
  onDismiss: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; y: number; axis: "x" | "y" | null } | null>(null);
  const leaving = useRef(false);
  // Een veeg eindigt ook in een click-event; die mag de melding niet openen.
  const swiped = useRef(false);

  function leave(direction: number) {
    if (leaving.current) return;
    leaving.current = true;
    setDragging(false);
    if (reduceMotion) {
      onDismiss();
      return;
    }
    setDx(direction * 400);
    window.setTimeout(onDismiss, LEAVE_MS);
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse" || leaving.current) return;
    drag.current = { x: e.clientX, y: e.clientY, axis: null };
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const state = drag.current;
    if (!state) return;
    const deltaX = e.clientX - state.x;
    const deltaY = e.clientY - state.y;
    if (state.axis === null) {
      if (Math.abs(deltaX) < AXIS_LOCK_PX && Math.abs(deltaY) < AXIS_LOCK_PX) return;
      // Verticaal betekent scrollen in de lijst; die beweging laten we los.
      state.axis = Math.abs(deltaX) > Math.abs(deltaY) ? "x" : "y";
      if (state.axis === "y") {
        drag.current = null;
        return;
      }
      e.currentTarget.setPointerCapture(e.pointerId);
      setDragging(true);
      swiped.current = true;
    }
    setDx(deltaX);
  }

  function onPointerUp() {
    const state = drag.current;
    drag.current = null;
    setDragging(false);
    if (!state || state.axis !== "x") return;
    if (Math.abs(dx) >= SWIPE_THRESHOLD_PX) leave(Math.sign(dx) || -1);
    else setDx(0);
  }

  function onPointerCancel() {
    drag.current = null;
    setDragging(false);
    setDx(0);
  }

  const past = Math.abs(dx) >= SWIPE_THRESHOLD_PX;

  return (
    <li className="relative overflow-hidden border-b border-neutral-100 last:border-0">
      {/* Komt onder de rij vandaan tijdens het vegen. */}
      <div
        aria-hidden
        className={cn(
          "absolute inset-0 flex items-center justify-between px-4 text-white transition-colors",
          past ? "bg-red-500" : "bg-red-400"
        )}
      >
        <Trash2 className="size-4" />
        <Trash2 className="size-4" />
      </div>

      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        style={dx === 0 ? undefined : { transform: `translateX(${dx}px)` }}
        className={cn(
          "relative flex touch-pan-y bg-surface-2",
          !dragging && "transition-transform duration-200 ease-out"
        )}
      >
        <div className={cn("flex min-w-0 flex-1", !item.read && "bg-accent-soft")}>
          <button
            type="button"
            onClick={() => {
              if (swiped.current) {
                swiped.current = false;
                return;
              }
              onOpen();
            }}
            className="flex min-w-0 flex-1 items-start gap-2.5 py-2.5 pl-3 pr-1 text-left transition-colors hover:bg-neutral-100/60"
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
                <span className="mt-0.5 line-clamp-2 text-xs text-neutral-500">{item.body}</span>
              ) : null}
              <span className="mt-0.5 block text-[11px] text-neutral-400">
                {relTime(item.createdAt)}
              </span>
            </span>
            {!item.read ? (
              <span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" />
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => leave(-1)}
            aria-label={`Melding wegvegen: ${item.title}`}
            className="flex w-11 shrink-0 items-center justify-center text-neutral-400 transition-colors hover:bg-neutral-100/60 hover:text-neutral-700 focus-ring"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    </li>
  );
}

/**
 * Belletje met ongelezen-teller en een paneel met recente in-app meldingen.
 * Server-gerenderde data komt via props; mutaties (gelezen markeren, wegvegen)
 * gaan via server-actions + `router.refresh()`.
 *
 * Weggeveegde meldingen verbergen we meteen lokaal zodat de lijst niet op de
 * server wacht; ze blijven verborgen, want de server heeft ze verwijderd.
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
  // Ids die we lokaal al hebben weggeveegd. Die blijven verborgen: de server
  // heeft ze verwijderd, dus ze komen bij een refresh sowieso niet terug.
  const [hidden, setHidden] = useState<string[]>([]);
  const [confirmClear, setConfirmClear] = useState(false);

  const visible = items.filter((i) => !hidden.includes(i.id));
  const hiddenUnread = items.filter((i) => !i.read && hidden.includes(i.id)).length;
  const badgeCount = Math.max(0, unreadCount - hiddenUnread);

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

  function dismiss(item: NotificationItem) {
    setHidden((prev) => (prev.includes(item.id) ? prev : [...prev, item.id]));
    start(async () => {
      await dismissNotification(item.id);
      router.refresh();
    });
  }

  function clearAll() {
    // Wegvegen kun je niet terugdraaien, dus alles-in-een-keer vraagt om een
    // tweede tik in plaats van een dialoog (blijft een handeling met duim).
    if (!confirmClear) {
      setConfirmClear(true);
      window.setTimeout(() => setConfirmClear(false), 4000);
      return;
    }
    setConfirmClear(false);
    setHidden(items.map((i) => i.id));
    start(async () => {
      await dismissAllNotifications();
      router.refresh();
    });
  }

  return (
    <Dropdown
      closeOnBack
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
          aria-label={badgeCount > 0 ? `Meldingen (${badgeCount} ongelezen)` : "Meldingen"}
          className="relative flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface-1 text-neutral-700 transition-colors hover:bg-neutral-50 focus-ring"
        >
          <Bell className="size-[18px]" />
          {badgeCount > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold leading-4 text-accent-foreground">
              {badgeCount > 9 ? "9+" : badgeCount}
            </span>
          ) : null}
        </button>
      )}
    >
      {({ close }) => (
        <div className="flex flex-col">
          <div className="flex items-center justify-between gap-2 px-3 py-2">
            <span className="text-sm font-semibold text-neutral-900">Meldingen</span>
            <div className="flex shrink-0 items-center gap-1">
              {badgeCount > 0 ? (
                <button
                  type="button"
                  onClick={markAll}
                  disabled={pending}
                  className="rounded-md px-1.5 py-1 text-xs font-medium text-accent hover:underline disabled:opacity-50 focus-ring"
                >
                  Alles gelezen
                </button>
              ) : null}
              {visible.length > 0 ? (
                <button
                  type="button"
                  onClick={clearAll}
                  disabled={pending}
                  className={cn(
                    "rounded-md px-1.5 py-1 text-xs font-medium hover:underline disabled:opacity-50 focus-ring",
                    confirmClear ? "text-red-600" : "text-neutral-500"
                  )}
                >
                  {confirmClear ? "Zeker weten?" : "Wis alles"}
                </button>
              ) : null}
            </div>
          </div>
          <div className="h-px bg-border" />

          {visible.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-neutral-500">
              Je hebt nog geen meldingen.
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {visible.map((item) => (
                <NotificationRow
                  key={item.id}
                  item={item}
                  onOpen={() => {
                    // Gaan we navigeren, dan laten we de history-entry van het
                    // paneel staan; een back() zou met de navigatie vechten.
                    close(item.link ? { keepHistory: true } : undefined);
                    openItem(item);
                  }}
                  onDismiss={() => dismiss(item)}
                />
              ))}
            </ul>
          )}

          <div className="h-px bg-border" />
          <Link
            href="/account/meldingen"
            onClick={() => close({ keepHistory: true })}
            className="block px-3 py-2 text-center text-xs font-medium text-neutral-500 transition-colors hover:text-neutral-900"
          >
            Meldingsinstellingen
          </Link>
        </div>
      )}
    </Dropdown>
  );
}
