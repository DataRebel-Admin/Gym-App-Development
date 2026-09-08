import { getLocale, getTranslations } from "next-intl/server";
import { requireMember } from "@/lib/member";
import { requireFeature } from "@/lib/features/service";
import { prisma } from "@/lib/db";
import { appBaseUrl } from "@/lib/app-url";
import { getMemberAgenda, getPlanEditorData } from "@/lib/calendar";
import { WeekdayPlanner } from "@/components/calendar/weekday-planner";
import { CalendarFeedCard } from "@/components/calendar/calendar-feed-card";
import { monthKeyOfDayKey, nextMonthKey, prevMonthKey } from "@/lib/calendar-plan";
import { Reveal, RevealItem } from "@/components/motion/reveal";
import { EmptyState } from "@/components/ui/empty-state";
import { AgendaMonthGrid } from "@/components/calendar/agenda-month-grid";
import { AgendaDayList } from "@/components/calendar/agenda-day-list";

export async function generateMetadata() {
  const t = await getTranslations("member.agenda");
  return { title: t("metaTitle") };
}

/**
 * Ledenagenda: maandraster + daglijst met geplande schema-dagen, gedane
 * trainingen en groepsles-aanmeldingen. Maandnavigatie is server-driven via
 * `?m=YYYY-MM` (deelbare URL, back-button werkt); alle dag-bucketing gebeurt in
 * lib/calendar.ts in de tijdzone van het lid.
 */
export default async function MemberAgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const member = await requireMember();
  await requireFeature(member.tenantId, "calendar");
  const { m } = await searchParams;
  const [agenda, planEditor, me, t, locale] = await Promise.all([
    getMemberAgenda(member.id, member.tenantId, m ?? null),
    getPlanEditorData(member.id, member.tenantId),
    prisma.user.findFirst({
      where: { id: member.id, tenantId: member.tenantId },
      select: { calendarFeedToken: true },
    }),
    getTranslations("member.agenda"),
    getLocale(),
  ]);
  const feedUrl = me?.calendarFeedToken
    ? `${appBaseUrl()}/api/calendar/${me.calendarFeedToken}`
    : null;

  const [year, monthNo] = agenda.monthKey.split("-").map(Number);
  const monthTitle = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, monthNo - 1, 1)));

  // De daglijst toont alleen dagen van deze maand mét inhoud (het raster toont
  // ook de aanloop-/uitloopdagen van de aangrenzende weken).
  const listDays = agenda.days.filter(
    (d) =>
      monthKeyOfDayKey(d.dayKey) === agenda.monthKey &&
      (d.planned.length > 0 || d.sessions.length > 0 || d.classes.length > 0)
  );

  return (
    <Reveal stagger className="flex flex-1 flex-col gap-5 px-5 py-7">
      <RevealItem>
        <h1 className="font-display text-2xl font-bold tracking-tight text-neutral-900">
          {t("title")}
        </h1>
        <p className="mt-1 text-neutral-500">{t("subtitle")}</p>
      </RevealItem>

      <RevealItem>
        <AgendaMonthGrid
          monthKey={agenda.monthKey}
          monthTitle={monthTitle}
          todayKey={agenda.todayKey}
          days={agenda.days}
          prevHref={`/member/agenda?m=${prevMonthKey(agenda.monthKey)}`}
          nextHref={`/member/agenda?m=${nextMonthKey(agenda.monthKey)}`}
        />
      </RevealItem>

      <RevealItem>
        {listDays.length > 0 ? (
          <AgendaDayList days={listDays} timeZone={agenda.timeZone} todayKey={agenda.todayKey} />
        ) : (
          <EmptyState icon="🗓️" title={t("emptyTitle")} description={t("emptyDesc")} />
        )}
      </RevealItem>

      {/* Weekdagplanning: alleen met een actief schema valt er iets te plannen. */}
      <RevealItem>
        {planEditor && planEditor.days.length > 0 ? (
          <WeekdayPlanner
            assignmentId={planEditor.assignmentId}
            days={planEditor.days}
            plan={planEditor.plan}
          />
        ) : (
          <p className="rounded-2xl border border-dashed border-border px-4 py-3 text-xs text-neutral-500">
            {t("plannerNoSchema")}
          </p>
        )}
      </RevealItem>

      {/* Agendakoppeling (ICS-feed voor Google/Outlook/Apple) */}
      <RevealItem>
        <CalendarFeedCard feedUrl={feedUrl} />
      </RevealItem>
    </Reveal>
  );
}
