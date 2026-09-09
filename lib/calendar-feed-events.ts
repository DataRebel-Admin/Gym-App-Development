import "server-only";
import type { MemberFeedData } from "@/lib/calendar";
import type { IcsEvent } from "@/lib/calendar-ics";

/**
 * Eén vertaling van de ruwe feed-rijen (`getMemberFeedEvents`) naar
 * kalender-events, gedeeld door de ICS-route én de toestel-agendasync
 * (`getDeviceCalendarEvents`). Zo dragen beide kanalen exact dezelfde titels,
 * tijden en stabiele UIDs: een lid dat van feed naar toestel-sync wisselt (of
 * andersom) ziet dezelfde agenda.
 *
 * `trainingLabel` = de vertaalde "Training"-kop (`member.agenda.icsTraining`);
 * de caller kiest de taal (feed: `localeFromEnum(user.locale)`, action: de
 * UI-taal van het lid).
 */
export function feedToIcsEvents(feed: MemberFeedData, trainingLabel: string): IcsEvent[] {
  const gym = feed.gymName;
  return [
    ...feed.planned.map(
      (p): IcsEvent => ({
        kind: "allday",
        uid: `plan-${p.assignmentId}-${p.dayKey}`,
        dayKey: p.dayKey,
        summary: `${trainingLabel}: ${p.dayName} · ${gym}`,
      })
    ),
    ...feed.classes.map(
      (c): IcsEvent => ({
        kind: "timed",
        uid: `class-${c.enrollmentId}`,
        startUtc: c.startsAt,
        endUtc: c.endsAt,
        summary: `${c.title} · ${gym}`,
        location: [c.venueName, c.room].filter(Boolean).join(" · ") || undefined,
        status: c.cancelled ? "CANCELLED" : c.waitlisted ? "TENTATIVE" : undefined,
      })
    ),
    ...feed.sessions.map(
      (s): IcsEvent => ({
        kind: "timed",
        uid: `session-${s.id}`,
        startUtc: s.startsAt,
        endUtc: s.endsAt,
        summary: `${trainingLabel}${s.dayName ? `: ${s.dayName}` : ""} · ${gym}`,
      })
    ),
  ];
}
