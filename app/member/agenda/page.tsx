import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { requireMember } from "@/lib/member";
import { requireFeature } from "@/lib/features/service";
import { prisma } from "@/lib/db";
import { getMemberAgenda, getPlanEditorData } from "@/lib/calendar";
import { isValidDayKey, nextMonthKey, prevMonthKey } from "@/lib/calendar-plan";
import { Reveal, RevealItem } from "@/components/motion/reveal";
import { CalendarDays, ChevronRight, Link2 } from "@/components/ui/icons";
import { AgendaCalendar } from "@/components/calendar/agenda-calendar";

export async function generateMetadata() {
  const t = await getTranslations("member.agenda");
  return { title: t("metaTitle") };
}

/**
 * Ledenagenda: maandraster + daglijst met geplande schema-dagen, gedane
 * trainingen en groepsles-aanmeldingen. Maandnavigatie is server-driven via
 * `?m=YYYY-MM` (deelbare URL, back-button werkt); alle dag-bucketing gebeurt in
 * lib/calendar.ts in de tijdzone van het lid. De weekdagplanner en de
 * agendakoppeling wonen op eigen subpagina's (/planning en /koppelen) —
 * hieronder alleen compacte ingangen met de actuele status.
 */
export default async function MemberAgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string; d?: string }>;
}) {
  const member = await requireMember();
  await requireFeature(member.tenantId, "calendar");
  const { m, d } = await searchParams;
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

  const [year, monthNo] = agenda.monthKey.split("-").map(Number);
  const monthTitle = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, monthNo - 1, 1)));

  const plannedDayCount = planEditor?.plan ? Object.keys(planEditor.plan.days).length : 0;
  const hasFeed = Boolean(me?.calendarFeedToken);

  return (
    <Reveal stagger className="flex flex-1 flex-col gap-5 px-5 py-7">
      <RevealItem>
        <h1 className="font-display text-2xl font-bold tracking-tight text-neutral-900">
          {t("title")}
        </h1>
        <p className="mt-1 text-neutral-500">{t("subtitle")}</p>
      </RevealItem>

      <RevealItem>
        <AgendaCalendar
          agenda={agenda}
          monthTitle={monthTitle}
          prevHref={`/member/agenda?m=${prevMonthKey(agenda.monthKey)}`}
          nextHref={`/member/agenda?m=${nextMonthKey(agenda.monthKey)}`}
          initialDayKey={d && isValidDayKey(d) ? d : null}
        />
      </RevealItem>

      {/* Ingangen naar de subpagina's, met actuele status als ondertitel. */}
      <RevealItem className="flex flex-col gap-2.5">
        <Link
          href="/member/agenda/planning"
          className="flex items-center gap-3 rounded-2xl border border-border bg-surface-1 p-4 shadow-sm transition-colors active:bg-surface-2"
        >
          <CalendarDays className="size-5 shrink-0 text-accent" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-neutral-900">
              {t("plannerTitle")}
            </span>
            <span className="block truncate text-xs text-neutral-500">
              {plannedDayCount > 0
                ? t("plannedDaysCount", { count: plannedDayCount })
                : t("plannerNotSet")}
            </span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-neutral-300" />
        </Link>
        <Link
          href="/member/agenda/koppelen"
          className="flex items-center gap-3 rounded-2xl border border-border bg-surface-1 p-4 shadow-sm transition-colors active:bg-surface-2"
        >
          <Link2 className="size-5 shrink-0 text-accent" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-neutral-900">{t("feedTitle")}</span>
            <span className="block truncate text-xs text-neutral-500">
              {hasFeed ? t("feedLinked") : t("feedNotLinked")}
            </span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-neutral-300" />
        </Link>
      </RevealItem>
    </Reveal>
  );
}
