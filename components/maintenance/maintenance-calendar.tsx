"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

export type CalendarItem = { date: string; name: string; overdue: boolean };

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

/** Maandkalender met de geplande volgende onderhoudsdata per machine. */
export function MaintenanceCalendar({ items }: { items: CalendarItem[] }) {
  const t = useTranslations("maintenance");
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return { year: n.getFullYear(), month: n.getMonth() };
  });

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const it of items) {
      const d = new Date(it.date);
      if (d.getFullYear() === cursor.year && d.getMonth() === cursor.month) {
        const key = String(d.getDate());
        map.set(key, [...(map.get(key) ?? []), it]);
      }
    }
    return map;
  }, [items, cursor]);

  const first = new Date(cursor.year, cursor.month, 1);
  // ma=0 … zo=6
  const offset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
  const today = new Date();
  const isThisMonth =
    today.getFullYear() === cursor.year && today.getMonth() === cursor.month;

  const cells: (number | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const shift = (delta: number) => {
    setCursor((c) => {
      const m = c.month + delta;
      return { year: c.year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 };
    });
  };

  return (
    <div className="rounded-2xl border border-border bg-surface-1 p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-900">{t("calendar.title")}</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => shift(-1)}
            aria-label={t("calendar.prevMonth")}
            className="rounded-lg px-2 py-1 text-neutral-500 hover:bg-neutral-100"
          >
            ‹
          </button>
          <span className="min-w-[9rem] text-center text-sm font-medium text-neutral-700">
            {t(`calendar.months.${cursor.month}`)} {cursor.year}
          </span>
          <button
            type="button"
            onClick={() => shift(1)}
            aria-label={t("calendar.nextMonth")}
            className="rounded-lg px-2 py-1 text-neutral-500 hover:bg-neutral-100"
          >
            ›
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-neutral-400">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-1">
            {t(`calendar.weekdays.${d}`)}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day == null) return <div key={`e${i}`} />;
          const dayItems = byDay.get(String(day)) ?? [];
          const hasOverdue = dayItems.some((it) => it.overdue);
          const isToday = isThisMonth && today.getDate() === day;
          return (
            <div
              key={day}
              className={cn(
                "min-h-[3.5rem] rounded-lg border p-1 text-left",
                dayItems.length
                  ? hasOverdue
                    ? "border-red-200 bg-red-50"
                    : "border-amber-200 bg-amber-50"
                  : "border-transparent",
                isToday && "ring-1 ring-accent"
              )}
            >
              <div className="text-[11px] font-semibold text-neutral-500">{day}</div>
              {dayItems.slice(0, 2).map((it, idx) => (
                <div
                  key={idx}
                  title={it.name}
                  className={cn(
                    "mt-0.5 truncate rounded px-1 text-[10px] font-medium",
                    it.overdue ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                  )}
                >
                  {it.name}
                </div>
              ))}
              {dayItems.length > 2 ? (
                <div className="mt-0.5 text-[10px] text-neutral-400">
                  {t("calendar.more", { count: dayItems.length - 2 })}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
