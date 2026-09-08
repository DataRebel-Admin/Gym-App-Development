"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { saveWeekdayPlan } from "@/app/member/agenda/actions";
import type { DayRef, IsoWeekday, WeekdayPlan } from "@/lib/calendar-plan";

const WEEKDAYS: IsoWeekday[] = [1, 2, 3, 4, 5, 6, 7];

/**
 * Weekdagplanner: per trainingsdag van het actieve schema een rij van 7 chips
 * (ma…zo). Optimistisch: elke tik werkt de lokale mapping bij en stuurt de
 * VOLLEDIGE mapping naar de server (idempotent, race-tolerant — idioom
 * quote-toggle). Een dag mag op meerdere weekdagen staan of ongepland blijven.
 */
export function WeekdayPlanner({
  assignmentId,
  days,
  plan,
}: {
  assignmentId: string;
  days: DayRef[];
  plan: WeekdayPlan | null;
}) {
  const t = useTranslations("member.agenda");
  const router = useRouter();
  const [mapping, setMapping] = useState<Record<string, IsoWeekday[]>>(plan?.days ?? {});
  const [pending, startTransition] = useTransition();

  function toggle(dayId: string, weekday: IsoWeekday) {
    const current = mapping[dayId] ?? [];
    const next = {
      ...mapping,
      [dayId]: current.includes(weekday)
        ? current.filter((w) => w !== weekday)
        : [...current, weekday].sort((a, b) => a - b),
    };
    setMapping(next);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("assignmentId", assignmentId);
      fd.set("plan", JSON.stringify(next));
      await saveWeekdayPlan(fd);
      // Agenda-raster meteen laten meekleuren met de nieuwe planning.
      router.refresh();
    });
  }

  return (
    <div className="rounded-3xl border border-border bg-surface-1 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-sm font-bold text-neutral-900">{t("plannerTitle")}</h2>
        {pending ? (
          <span className="text-[11px] text-neutral-400">{t("plannerSaving")}</span>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-neutral-500">{t("plannerDesc")}</p>

      <div className="mt-3 flex flex-col gap-3">
        {days.map((day) => {
          const selected = mapping[day.id] ?? [];
          return (
            <div key={day.id}>
              <p className="text-sm font-semibold text-neutral-800">
                {day.name}
                {selected.length === 0 ? (
                  <span className="ml-2 text-[11px] font-normal text-neutral-400">
                    {t("plannerUnplanned")}
                  </span>
                ) : null}
              </p>
              <div className="mt-1.5 grid grid-cols-7 gap-1">
                {WEEKDAYS.map((wd) => {
                  const on = selected.includes(wd);
                  return (
                    <button
                      key={wd}
                      type="button"
                      onClick={() => toggle(day.id, wd)}
                      aria-pressed={on}
                      className={cn(
                        "min-h-9 rounded-xl border text-xs font-semibold transition-colors",
                        on
                          ? "border-accent bg-accent text-accent-foreground"
                          : "border-border bg-surface-1 text-neutral-500 active:bg-surface-2"
                      )}
                    >
                      {t(`wd${wd}`)}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
