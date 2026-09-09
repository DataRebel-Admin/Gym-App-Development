import { useSyncExternalStore } from "react";
import { Capacitor, registerPlugin, type PermissionState } from "@capacitor/core";
import { shouldAutoSync, type DeviceCalendarEvent } from "@/lib/calendar-device";

/**
 * Web-kant van de toestel-agendasync (CalendarSyncPlugin.java): de app
 * schrijft de agenda-events van het lid rechtstreeks in een agenda op het
 * toestel (bv. de Google-agenda), die Android zelf naar alle apparaten
 * synchroniseert. Dít is de "automatische" route op een telefoon — abonneren
 * via een link bestaat daar niet bij Google/Outlook.
 *
 * Idioom lib/app-lock.ts: alleen vanuit client-componenten gebruiken, alles
 * faalt zacht, en de koppeling (welke agenda) is per TOESTEL in localStorage
 * — het toestel ís de agenda. De koppeling draagt het `userId` zodat een
 * ander account op hetzelfde toestel niet in andermans agenda schrijft.
 * Alleen Android: iOS abonneert via webcal:// op Apple Agenda, en de iOS-map
 * staat niet in de repo (zie docs/CAPACITOR.md).
 */
export type DeviceCalendar = {
  id: string;
  name: string;
  account: string;
  primary: boolean;
  color: string | null;
};

export type DeviceCalendarLink = {
  userId: string;
  calendarId: string;
  calendarName: string;
  lastSyncAt: number | null;
};

export type DeviceSyncResult =
  | { ok: true; count: number }
  | { ok: false; reason: "unsupported" | "unlinked" | "permission" | "error" };

type CalendarSyncPluginApi = {
  checkPermissions(): Promise<{ calendar: PermissionState }>;
  requestPermissions(): Promise<{ calendar: PermissionState }>;
  listCalendars(): Promise<{ calendars: DeviceCalendar[] }>;
  sync(options: {
    calendarId: string;
    events: DeviceCalendarEvent[];
  }): Promise<{ inserted: number; updated: number; deleted: number }>;
  unlink(): Promise<{ deleted: number }>;
};

let plugin: CalendarSyncPluginApi | null = null;
function calendarSync(): CalendarSyncPluginApi {
  plugin ??= registerPlugin<CalendarSyncPluginApi>("CalendarSync");
  return plugin;
}

/** Alleen de Android-app kan in de toestelagenda schrijven. */
export function deviceCalendarSupported(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
  } catch {
    return false;
  }
}

// ---------- koppeling (per toestel) ----------

const LINK_KEY = "gymrebel-device-calendar";
let linkCache: DeviceCalendarLink | null | undefined;
const listeners = new Set<() => void>();

function readLink(): DeviceCalendarLink | null {
  try {
    const raw = window.localStorage.getItem(LINK_KEY);
    if (!raw) return null;
    const v: unknown = JSON.parse(raw);
    if (
      typeof v === "object" &&
      v !== null &&
      typeof (v as DeviceCalendarLink).userId === "string" &&
      typeof (v as DeviceCalendarLink).calendarId === "string" &&
      typeof (v as DeviceCalendarLink).calendarName === "string"
    ) {
      const l = v as DeviceCalendarLink;
      return {
        userId: l.userId,
        calendarId: l.calendarId,
        calendarName: l.calendarName,
        lastSyncAt: typeof l.lastSyncAt === "number" ? l.lastSyncAt : null,
      };
    }
  } catch {
    /* genegeerd */
  }
  return null;
}

function snapshot(): DeviceCalendarLink | null {
  if (linkCache === undefined) linkCache = readLink();
  return linkCache;
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function writeLink(link: DeviceCalendarLink | null): void {
  linkCache = link;
  try {
    if (link) window.localStorage.setItem(LINK_KEY, JSON.stringify(link));
    else window.localStorage.removeItem(LINK_KEY);
  } catch {
    /* genegeerd */
  }
  listeners.forEach((l) => l());
}

export function getDeviceCalendarLink(userId: string): DeviceCalendarLink | null {
  const link = snapshot();
  return link && link.userId === userId ? link : null;
}

/** Reactieve variant voor componenten (server/hydratie: null). */
export function useDeviceCalendarLink(userId: string): DeviceCalendarLink | null {
  const link = useSyncExternalStore(subscribe, snapshot, () => null);
  return link && link.userId === userId ? link : null;
}

export function setDeviceCalendarLink(link: DeviceCalendarLink): void {
  writeLink(link);
}

// ---------- plugin-aanroepen (falen nooit hard) ----------

export async function hasCalendarPermission(): Promise<boolean> {
  try {
    return (await calendarSync().checkPermissions()).calendar === "granted";
  } catch {
    return false;
  }
}

/** Vraag de agenda-toestemming (systeemdialoog) als die er nog niet is. */
export async function ensureCalendarPermission(): Promise<boolean> {
  try {
    let state = (await calendarSync().checkPermissions()).calendar;
    if (state !== "granted") state = (await calendarSync().requestPermissions()).calendar;
    return state === "granted";
  } catch {
    return false;
  }
}

export async function listDeviceCalendars(): Promise<DeviceCalendar[]> {
  try {
    return (await calendarSync().listCalendars()).calendars;
  } catch {
    return [];
  }
}

export type DeviceEventsFetcher = () => Promise<
  { ok: true; events: DeviceCalendarEvent[] } | { ok: false }
>;

/**
 * Volledige sync: events ophalen (server-action, meegegeven zodat deze module
 * geen server-import draagt) en in de gekoppelde agenda schrijven. Werkt de
 * `lastSyncAt` bij — die stuurt de automatische cadans.
 */
export async function performDeviceCalendarSync(
  userId: string,
  fetchEvents: DeviceEventsFetcher
): Promise<DeviceSyncResult> {
  if (!deviceCalendarSupported()) return { ok: false, reason: "unsupported" };
  const link = getDeviceCalendarLink(userId);
  if (!link) return { ok: false, reason: "unlinked" };
  if (!(await hasCalendarPermission())) return { ok: false, reason: "permission" };
  try {
    const res = await fetchEvents();
    if (!res.ok) return { ok: false, reason: "error" };
    const r = await calendarSync().sync({ calendarId: link.calendarId, events: res.events });
    writeLink({ ...link, lastSyncAt: Date.now() });
    return { ok: true, count: r.inserted + r.updated + r.deleted };
  } catch {
    return { ok: false, reason: "error" };
  }
}

/** Automatisch bijwerken nodig? (gekoppeld én interval verstreken) */
export function deviceSyncDue(userId: string, now: number = Date.now()): boolean {
  const link = getDeviceCalendarLink(userId);
  return link ? shouldAutoSync(link.lastSyncAt, now) : false;
}

/** Loskoppelen: onze events uit de toestelagenda halen en de koppeling wissen. */
export async function unlinkDeviceCalendar(): Promise<void> {
  try {
    if (await hasCalendarPermission()) await calendarSync().unlink();
  } catch {
    /* de koppeling gaat hoe dan ook weg */
  }
  writeLink(null);
}
