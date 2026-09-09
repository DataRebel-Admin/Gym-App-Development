"use client";

import { useEffect } from "react";
import {
  deviceCalendarSupported,
  deviceSyncDue,
  performDeviceCalendarSync,
} from "@/lib/calendar-device-sync";
import { getDeviceCalendarEvents } from "@/app/member/agenda/actions";

/**
 * Werkt de gekoppelde toestelagenda automatisch bij: bij het openen van de app
 * (mount van de member-layout) en telkens als de app weer in beeld komt, maar
 * nooit vaker dan `DEVICE_SYNC_MIN_INTERVAL_MS` (lib/calendar-device.ts). Zo
 * staan nieuwe lessen, geplande dagen en gedane trainingen vanzelf in Google
 * Agenda zonder dat het lid iets hoeft te doen. No-op buiten de Android-app of
 * zonder koppeling; fouten zijn stil (de koppelpagina toont ze wél).
 */
export function DeviceCalendarAutosync({ userId }: { userId: string }) {
  useEffect(() => {
    if (!deviceCalendarSupported()) return;
    let running = false;
    const tick = () => {
      if (running || !deviceSyncDue(userId)) return;
      running = true;
      void performDeviceCalendarSync(userId, getDeviceCalendarEvents).finally(() => {
        running = false;
      });
    };
    tick();
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [userId]);
  return null;
}
