import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { isFeatureEnabled } from "@/lib/features/service";
import { getMemberFeedEvents } from "@/lib/calendar";
import { buildIcs, type IcsEvent } from "@/lib/calendar-ics";
import { localeFromEnum } from "@/lib/i18n/config";
import { appBaseUrl } from "@/lib/app-url";

/**
 * Publieke ICS-abonnementsfeed: externe kalenderservers (Google/Outlook/Apple)
 * fetchen zonder cookies, dus géén auth — de onraadbare token IS het geheim
 * (zelfde model als de machine-QR-route /m/[qrToken]). Onbekende of
 * ingetrokken token → plat 404. Bewust `isFeatureEnabled` + kale Response
 * i.p.v. `requireFeature` (dat een HTML-notFound rendert; dit is text/calendar).
 * Feed-fetches worden bewust niet geaudit (ruis — zelfde afweging als QR-scans).
 */
export const dynamic = "force-dynamic";

const TOKEN_RE = /^[0-9a-f]{32,64}$/;
const notFound = () => new Response("Not found", { status: 404 });

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  // Vormcheck vóór de DB-hit (scanners/junk-URL's raken de database niet).
  if (!TOKEN_RE.test(token)) return notFound();

  const user = await prisma.user.findUnique({
    where: { calendarFeedToken: token },
    select: { id: true, tenantId: true, active: true },
  });
  if (!user?.tenantId || !user.active) return notFound();
  if (!(await isFeatureEnabled(user.tenantId, "calendar"))) return notFound();

  const feed = await getMemberFeedEvents(user.id, user.tenantId);
  if (!feed) return notFound();

  // Taal van het lid, zonder request-context: localeFromEnum(user.locale) —
  // hetzelfde patroon als de e-mails (lib/schema-notify.ts).
  const t = await getTranslations({
    locale: localeFromEnum(feed.locale),
    namespace: "member.agenda",
  });
  const gym = feed.gymName;

  const events: IcsEvent[] = [
    ...feed.planned.map(
      (p): IcsEvent => ({
        kind: "allday",
        uid: `plan-${p.assignmentId}-${p.dayKey}`,
        dayKey: p.dayKey,
        summary: `${t("icsTraining")}: ${p.dayName} · ${gym}`,
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
        summary: `${t("icsTraining")}${s.dayName ? `: ${s.dayName}` : ""} · ${gym}`,
      })
    ),
  ];

  const body = buildIcs(
    {
      name: `${gym} · ${t("metaTitle")}`,
      timeZoneHint: feed.timeZone,
      uidDomain: new URL(appBaseUrl()).host,
    },
    events,
    new Date()
  );

  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="agenda.ics"',
      "Cache-Control": "private, max-age=300",
    },
  });
}
