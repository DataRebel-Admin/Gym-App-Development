import type { IcsEvent } from "@/lib/calendar-ics";

/**
 * Pure kern van de toestel-agendasync (géén `server-only`, ook client + test).
 *
 * Op een telefoon bestaat "abonneren via URL" niet bij Google Agenda en
 * Outlook, dus de app schrijft de agenda-events daar rechtstreeks in een
 * agenda op het toestel (Android CalendarContract via CalendarSyncPlugin.java).
 * Dit bestand vertaalt de gedeelde feed-events (`IcsEvent`) naar het platte
 * formaat dat de plugin verwacht, en houdt de sync-cadans vast.
 *
 * Contract met de plugin (JSON, dus alleen primitieven):
 * - tijden in epoch-milliseconden; hele-dag-events als UTC-middernacht met een
 *   EXCLUSIEVE `endMs` (de dag erna) — precies wat CalendarContract voorschrijft
 *   voor `ALL_DAY=1`;
 * - `uid` = dezelfde stabiele UID als in de ICS-feed; de plugin bewaart 'm als
 *   `CUSTOM_APP_URI` en herkent daaraan eigen events (bijwerken/opruimen i.p.v.
 *   dubbelen);
 * - geannuleerde events gaan NIET mee: alles wat niet meer in de lijst staat
 *   wordt door de plugin verwijderd (zelfde effect als STATUS:CANCELLED bij
 *   een feed).
 */
export type DeviceCalendarEvent = {
  uid: string;
  title: string;
  location?: string;
  allDay: boolean;
  startMs: number;
  endMs: number;
  /** Wachtlijst → "voorlopig" in de agenda-app. */
  tentative: boolean;
};

/** Niet vaker dan dit automatisch bijwerken bij het openen van de app. */
export const DEVICE_SYNC_MIN_INTERVAL_MS = 6 * 60 * 60 * 1000;

const DAY_MS = 86_400_000;

/** "YYYY-MM-DD" → UTC-middernacht in ms (hele-dag-conventie van CalendarContract). */
export function allDayUtcMs(dayKey: string): number {
  const [y, m, d] = dayKey.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function icsEventsToDeviceEvents(events: IcsEvent[]): DeviceCalendarEvent[] {
  const out: DeviceCalendarEvent[] = [];
  for (const e of events) {
    if (e.status === "CANCELLED") continue;
    if (e.kind === "allday") {
      const start = allDayUtcMs(e.dayKey);
      out.push({
        uid: e.uid,
        title: e.summary,
        allDay: true,
        startMs: start,
        endMs: start + DAY_MS,
        tentative: e.status === "TENTATIVE",
      });
    } else {
      out.push({
        uid: e.uid,
        title: e.summary,
        location: e.location,
        allDay: false,
        startMs: e.startUtc.getTime(),
        endMs: e.endUtc.getTime(),
        tentative: e.status === "TENTATIVE",
      });
    }
  }
  return out;
}

/** Automatisch bijwerken? Nooit gesynct → ja; anders pas na het interval. */
export function shouldAutoSync(lastSyncAt: number | null, now: number): boolean {
  if (lastSyncAt === null) return true;
  return now - lastSyncAt >= DEVICE_SYNC_MIN_INTERVAL_MS;
}
