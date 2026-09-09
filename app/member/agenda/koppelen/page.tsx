import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireMember } from "@/lib/member";
import { requireFeature } from "@/lib/features/service";
import { getCurrentTenant } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { appBaseUrl } from "@/lib/app-url";
import { Reveal, RevealItem } from "@/components/motion/reveal";
import { ChevronLeft } from "@/components/ui/icons";
import { CalendarFeedCard } from "@/components/calendar/calendar-feed-card";
import { DeviceCalendarCard } from "@/components/calendar/device-calendar-card";

export async function generateMetadata() {
  const t = await getTranslations("member.agenda");
  return { title: t("feedTitle") };
}

/** Subpagina van de agenda: de ICS-abonnementsfeed aanmaken en koppelen. */
export default async function AgendaKoppelenPage() {
  const member = await requireMember();
  await requireFeature(member.tenantId, "calendar");
  const [me, tenant, t] = await Promise.all([
    prisma.user.findFirst({
      where: { id: member.id, tenantId: member.tenantId },
      select: { calendarFeedToken: true },
    }),
    getCurrentTenant(),
    getTranslations("member.agenda"),
  ]);
  const feedUrl = me?.calendarFeedToken
    ? `${appBaseUrl()}/api/calendar/${me.calendarFeedToken}`
    : null;

  return (
    <Reveal stagger className="flex flex-1 flex-col gap-5 px-5 py-7">
      <RevealItem>
        <Link
          href="/member/agenda"
          className="inline-flex items-center gap-1 text-sm font-medium text-neutral-500 active:text-neutral-700"
        >
          <ChevronLeft className="size-4" /> {t("backToAgenda")}
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-neutral-900">
          {t("feedTitle")}
        </h1>
        <p className="mt-1 text-neutral-500">{t("feedDesc")}</p>
      </RevealItem>

      {/* Android-app: rechtstreeks in de toestelagenda schrijven (rendert
          zichzelf alleen daar). De feed-kaart eronder blijft voor desktop,
          iOS (webcal) en wie liever een abonnementslink gebruikt. */}
      <RevealItem>
        <DeviceCalendarCard userId={member.id} />
      </RevealItem>

      <RevealItem>
        <CalendarFeedCard feedUrl={feedUrl} calendarName={tenant?.name ?? null} />
      </RevealItem>
    </Reveal>
  );
}
