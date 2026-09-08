import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { monthKeyOfDayKey } from "@/lib/calendar-plan";
import type { AgendaDay } from "@/lib/calendar";

/**
 * Maandraster van de ledenagenda (server component, alleen links — de
 * maandnavigatie is server-driven via ?m=). Per cel dots voor gepland/gedaan/
 * les; een cel mét inhoud linkt naar het bijbehorende dag-anker in de lijst.
 * Datumrekenwerk gebeurt niet hier: de dagen komen kant-en-klaar (en al in de
 * lid-tijdzone gebucket) uit lib/calendar.ts.
 */
export function AgendaMonthGrid({
  monthKey,
  monthTitle,
  todayKey,
  days,
  prevHref,
  nextHref,
}: {
  monthKey: string;
  monthTitle: string;
  todayKey: string;
  days: AgendaDay[];
  prevHref: string;
  nextHref: string;
}) {
  const t = useTranslations("member.agenda");
  const weekdayLabels = [1, 2, 3, 4, 5, 6, 7].map((n) => t(`wd${n}`));

  return (
    <div className="rounded-3xl border border-border bg-surface-1 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <Link
          href={prevHref}
          aria-label={t("monthPrev")}
          className="flex size-9 items-center justify-center rounded-xl border border-border text-neutral-600 active:bg-surface-2"
        >
          <ChevronLeft className="size-5" />
        </Link>
        <p className="font-display text-base font-bold capitalize text-neutral-900">
          {monthTitle}
        </p>
        <Link
          href={nextHref}
          aria-label={t("monthNext")}
          className="flex size-9 items-center justify-center rounded-xl border border-border text-neutral-600 active:bg-surface-2"
        >
          <ChevronRight className="size-5" />
        </Link>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
        {weekdayLabels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {days.map((day) => {
          const inMonth = monthKeyOfDayKey(day.dayKey) === monthKey;
          const isToday = day.dayKey === todayKey;
          const hasDone =
            day.sessions.length > 0 ||
            day.planned.some((p) => p.status === "done" || p.status === "shifted");
          const hasPlanned = day.planned.some(
            (p) => p.status === "upcoming" || p.status === "pending" || p.status === "missed"
          );
          const hasClass = day.classes.length > 0;
          const hasContent = hasDone || hasPlanned || hasClass;
          const dayNumber = Number(day.dayKey.slice(8));

          const cell = (
            <span
              className={cn(
                "flex min-h-11 flex-col items-center justify-center gap-1 rounded-xl py-1 text-sm",
                inMonth ? "text-neutral-800" : "text-neutral-300",
                isToday && "bg-accent-soft font-bold text-accent ring-1 ring-accent/30",
                hasContent && !isToday && "bg-surface-2"
              )}
            >
              {dayNumber}
              <span className="flex h-1.5 items-center gap-0.5">
                {hasDone ? <span className="size-1.5 rounded-full bg-accent" /> : null}
                {hasPlanned ? (
                  <span className="size-1.5 rounded-full border border-accent/60" />
                ) : null}
                {hasClass ? <span className="size-1.5 rounded-full bg-sky-400" /> : null}
              </span>
            </span>
          );

          return hasContent ? (
            <a key={day.dayKey} href={`#d-${day.dayKey}`} className="active:opacity-70">
              {cell}
            </a>
          ) : (
            <span key={day.dayKey}>{cell}</span>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-neutral-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-accent" /> {t("legendDone")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-1.5 rounded-full border border-accent/60" /> {t("legendPlanned")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-sky-400" /> {t("legendClass")}
        </span>
      </div>
    </div>
  );
}
