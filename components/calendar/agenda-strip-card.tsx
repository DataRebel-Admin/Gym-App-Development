import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { formatTimeRange } from "@/lib/datetime";
import { monthKeyOfDayKey } from "@/lib/calendar-plan";
import { CalendarDays, ChevronRight } from "@/components/ui/icons";
import { DragScroll } from "@/components/ui/drag-scroll";
import type { AgendaStrip } from "@/lib/calendar";

/**
 * Dashboard-widget "Volgende training": de eerstvolgende geplande schema-dag of
 * les, met daaronder een horizontaal scrollbare strip van losse dagblokjes
 * (vandaag + komende dagen, scroll-snap). Elk blokje navigeert naar de agenda
 * met die dag voorgeselecteerd. Server component — de strip is puur CSS.
 */

function utcOf(dayKey: string): Date {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function AgendaStripCard({ strip }: { strip: AgendaStrip }) {
  const t = useTranslations("member.home");
  const locale = useLocale();
  const wdFmt = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
  const dateFmt = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });

  function relLabel(dayKey: string): string {
    if (dayKey === strip.todayKey) return t("relToday");
    const diff = (utcOf(dayKey).getTime() - utcOf(strip.todayKey).getTime()) / 86_400_000;
    if (diff === 1) return t("relTomorrow");
    return dateFmt.format(utcOf(dayKey));
  }

  const next = strip.nextUp;
  const headline =
    next === null ? t("nextNoneTitle") : next.kind === "training" ? next.dayName : next.title;
  const sub =
    next === null
      ? t("nextNoneDesc")
      : next.kind === "training"
        ? relLabel(next.dayKey)
        : `${relLabel(next.dayKey)} · ${formatTimeRange(
            new Date(next.startIso),
            new Date(next.endIso),
            next.timezone
          )}`;

  return (
    <div className="rounded-3xl border border-border bg-surface-1 p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">
          {t("nextTrainingTitle")}
        </p>
        <Link
          href="/member/agenda"
          className="inline-flex items-center gap-1 text-xs font-semibold text-accent"
        >
          {t("agenda")} <ChevronRight className="size-3.5" />
        </Link>
      </div>

      <p className="mt-1 inline-flex items-center gap-2 font-display text-lg font-bold leading-tight text-neutral-900">
        <CalendarDays className="size-5 shrink-0 text-accent" />
        <span className="min-w-0 truncate">{headline}</span>
      </p>
      <p className="mt-0.5 text-sm capitalize text-neutral-500">{sub}</p>

      {/* Dagenstrip: bleedt tot de kaartrand; swipen/slepen zonder zichtbare
          scrollbalk (DragScroll regelt muis-slepen + verbergt de balk). */}
      <DragScroll className="-mx-5 mt-3 flex snap-x snap-mandatory gap-2 px-5">
        {strip.days.map((day) => {
          const isToday = day.dayKey === strip.todayKey;
          const hasDone =
            day.sessions.length > 0 ||
            day.planned.some((p) => p.status === "done" || p.status === "shifted");
          const hasPlanned = day.planned.some(
            (p) => p.status === "upcoming" || p.status === "pending" || p.status === "missed"
          );
          const hasClass = day.classes.some((c) => !c.cancelled);
          return (
            <Link
              key={day.dayKey}
              href={`/member/agenda?m=${monthKeyOfDayKey(day.dayKey)}&d=${day.dayKey}`}
              className={cn(
                "flex w-14 shrink-0 snap-start flex-col items-center gap-0.5 rounded-2xl border py-2.5 transition-colors",
                isToday
                  ? "border-accent bg-accent-soft"
                  : "border-border bg-surface-1 active:bg-surface-2"
              )}
            >
              <span className="text-[10px] font-semibold uppercase text-neutral-400">
                {wdFmt.format(utcOf(day.dayKey))}
              </span>
              <span
                className={cn(
                  "text-base font-bold",
                  isToday ? "text-accent" : "text-neutral-800"
                )}
              >
                {Number(day.dayKey.slice(8))}
              </span>
              <span className="flex h-1.5 items-center gap-0.5">
                {hasDone ? <span className="size-1.5 rounded-full bg-accent" /> : null}
                {hasPlanned ? (
                  <span className="size-1.5 rounded-full border border-accent/60" />
                ) : null}
                {hasClass ? <span className="size-1.5 rounded-full bg-sky-400" /> : null}
              </span>
            </Link>
          );
        })}
      </DragScroll>
    </div>
  );
}
