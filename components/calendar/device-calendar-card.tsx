"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { CalendarDays, Check } from "@/components/ui/icons";
import { useIsNativeApp, usePlatform } from "@/lib/platform";
import {
  ensureCalendarPermission,
  listDeviceCalendars,
  performDeviceCalendarSync,
  setDeviceCalendarLink,
  unlinkDeviceCalendar,
  useDeviceCalendarLink,
  type DeviceCalendar,
  type DeviceSyncResult,
} from "@/lib/calendar-device-sync";
import { getDeviceCalendarEvents } from "@/app/member/agenda/actions";

/**
 * "Zet in de agenda van je telefoon" — de automatische route in de Android-app:
 * agenda-toestemming → agenda kiezen (één agenda = direct koppelen) → sync. De
 * events staan daarna in de gekozen toestelagenda (bv. Google) en Android
 * synchroniseert ze zelf verder. Rendert niets buiten de Android-app; op iOS
 * doet de webcal-knop in `CalendarFeedCard` dit werk.
 *
 * De koppeling leeft per toestel (lib/calendar-device-sync.ts); de kaart is
 * daar een reactieve weergave van (`useDeviceCalendarLink`). Bijwerken gebeurt
 * hier handmatig én automatisch bij het openen van de app
 * (`DeviceCalendarAutosync` in de member-layout).
 */
export function DeviceCalendarCard({ userId }: { userId: string }) {
  const t = useTranslations("member.agenda");
  const locale = useLocale();
  const native = useIsNativeApp();
  const platform = usePlatform();
  const link = useDeviceCalendarLink(userId);
  const [busy, setBusy] = useState(false);
  const [calendars, setCalendars] = useState<DeviceCalendar[] | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [status, setStatus] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [armed, setArmed] = useState(false);
  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (armTimer.current) clearTimeout(armTimer.current);
  }, []);

  if (!native || platform !== "android") return null;

  function describe(result: DeviceSyncResult): { tone: "ok" | "error"; text: string } {
    if (result.ok) return { tone: "ok", text: t("deviceSynced", { count: result.count }) };
    if (result.reason === "permission") return { tone: "error", text: t("devicePermissionDenied") };
    return { tone: "error", text: t("deviceError") };
  }

  async function sync() {
    setBusy(true);
    setStatus(null);
    const result = await performDeviceCalendarSync(userId, getDeviceCalendarEvents);
    setStatus(describe(result));
    setBusy(false);
  }

  async function finishLink(cal: DeviceCalendar) {
    setDeviceCalendarLink({
      userId,
      calendarId: cal.id,
      calendarName: cal.name || cal.account,
      lastSyncAt: null,
    });
    setCalendars(null);
    await sync();
  }

  async function startLink() {
    setBusy(true);
    setStatus(null);
    if (!(await ensureCalendarPermission())) {
      setStatus({ tone: "error", text: t("devicePermissionDenied") });
      setBusy(false);
      return;
    }
    const list = await listDeviceCalendars();
    if (list.length === 0) {
      setStatus({ tone: "error", text: t("deviceNoCalendars") });
      setBusy(false);
      return;
    }
    if (list.length === 1) {
      await finishLink(list[0]);
      return;
    }
    setCalendars(list);
    setChosen(list.find((c) => c.primary)?.id ?? list[0].id);
    setBusy(false);
  }

  async function unlink() {
    if (!armed) {
      setArmed(true);
      if (armTimer.current) clearTimeout(armTimer.current);
      armTimer.current = setTimeout(() => setArmed(false), 4000);
      return;
    }
    setArmed(false);
    setBusy(true);
    await unlinkDeviceCalendar();
    setStatus(null);
    setBusy(false);
  }

  const lastSync = link?.lastSyncAt
    ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
        link.lastSyncAt
      )
    : null;

  return (
    <div className="rounded-3xl border border-accent/40 bg-surface-1 p-4 shadow-sm">
      <p className="font-display text-base font-bold text-neutral-900">{t("deviceTitle")}</p>
      <p className="mt-1 text-xs text-neutral-500">{t("deviceDesc")}</p>

      {link ? (
        <div className="mt-3">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-neutral-800">
            <Check className="size-4 text-accent" /> {t("deviceLinked", { name: link.calendarName })}
          </p>
          <p className="mt-0.5 text-[11px] text-neutral-400">
            {lastSync ? t("deviceLastSync", { time: lastSync }) : t("deviceNeverSynced")}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void sync()}
              className="rounded-xl bg-accent px-3 py-2.5 text-sm font-bold text-accent-foreground active:opacity-90 disabled:opacity-60"
            >
              {busy ? t("deviceBusy") : t("deviceSyncNow")}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void unlink()}
              className={cn(
                "rounded-xl border px-3 py-2.5 text-sm font-semibold disabled:opacity-60",
                armed
                  ? "border-red-400 text-red-600"
                  : "border-border text-neutral-600 active:bg-surface-2"
              )}
            >
              {armed ? t("deviceUnlinkConfirm") : t("deviceUnlink")}
            </button>
          </div>
          <p className="mt-2 text-[11px] text-neutral-400">{t("deviceAutoNote")}</p>
          {armed ? (
            <p className="mt-1 text-[11px] text-neutral-500">{t("deviceUnlinkHint")}</p>
          ) : null}
        </div>
      ) : calendars ? (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            {t("deviceChoose")}
          </p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {calendars.map((cal) => (
              <li key={cal.id}>
                <label
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5",
                    chosen === cal.id ? "border-accent bg-accent-soft" : "border-border"
                  )}
                >
                  <input
                    type="radio"
                    name="device-calendar"
                    className="accent-[var(--tenant-accent)]"
                    checked={chosen === cal.id}
                    onChange={() => setChosen(cal.id)}
                  />
                  <span
                    className="size-3 shrink-0 rounded-full"
                    style={{ background: cal.color ?? "var(--tenant-accent)" }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-neutral-800">
                      {cal.name || cal.account}
                    </span>
                    {cal.account && cal.account !== cal.name ? (
                      <span className="block truncate text-[11px] text-neutral-400">
                        {cal.account}
                      </span>
                    ) : null}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={busy || !chosen}
              onClick={() => {
                const cal = calendars.find((c) => c.id === chosen);
                if (cal) void finishLink(cal);
              }}
              className="rounded-xl bg-accent px-3 py-2.5 text-sm font-bold text-accent-foreground active:opacity-90 disabled:opacity-60"
            >
              {busy ? t("deviceBusy") : t("deviceLink")}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setCalendars(null)}
              className="rounded-xl border border-border px-3 py-2.5 text-sm font-semibold text-neutral-600 active:bg-surface-2 disabled:opacity-60"
            >
              {t("deviceCancel")}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => void startLink()}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-accent-foreground active:opacity-90 disabled:opacity-60"
        >
          <CalendarDays className="size-4" /> {busy ? t("deviceBusy") : t("deviceLink")}
        </button>
      )}

      {status ? (
        <p
          className={cn(
            "mt-3 text-xs",
            status.tone === "ok" ? "text-accent" : "text-red-600"
          )}
          role="status"
        >
          {status.text}
        </p>
      ) : null}
    </div>
  );
}
