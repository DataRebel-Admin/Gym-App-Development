"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { monthKeyOfDayKey } from "@/lib/calendar-plan";
import { ChevronLeft, ChevronRight } from "@/components/ui/icons";
import {
  AgendaDayDetail,
  hasContent,
} from "@/components/calendar/agenda-day-detail";
import type { AgendaMonth } from "@/lib/calendar";

/**
 * Interactieve maandagenda (agenda-app-patroon): het raster blijft staan en de
 * aangetikte dag verschijnt direct in het detailpaneel eronder — géén
 * anker-sprongen of terugscrollen. Maandnavigatie blijft server-driven via
 * `?m=`-links.
 *
 * `mode="link"` (historie-preview): tikken navigeert naar de agenda-pagina met
 * de dag voorgeselecteerd (`?m=…&d=…`); er is dan geen detailpaneel.
 *
 * Het detailpaneel zelf is het gedeelde `AgendaDayDetail` (ook op de
 * dagenstrip van /member).
 */

export function AgendaCalendar({
  agenda,
  monthTitle,
  prevHref,
  nextHref,
  mode = "interactive",
  linkBase = "/member/agenda",
  initialDayKey = null,
}: {
  agenda: AgendaMonth;
  monthTitle: string;
  prevHref: string;
  nextHref: string;
  mode?: "interactive" | "link";
  linkBase?: string;
  initialDayKey?: string | null;
}) {
  const t = useTranslations("member.agenda");
  const { monthKey, todayKey, timeZone, days } = agenda;

  const inMonth = (k: string) => monthKeyOfDayKey(k) === monthKey;
  const firstWithContent =
    days.find((d) => inMonth(d.dayKey) && hasContent(d))?.dayKey ?? null;
  const monthHasContent = firstWithContent !== null;
  const defaultSelected =
    initialDayKey && days.some((d) => d.dayKey === initialDayKey)
      ? initialDayKey
      : days.some((d) => d.dayKey === todayKey && inMonth(todayKey))
        ? todayKey
        : (firstWithContent ??
          days.find((d) => inMonth(d.dayKey))?.dayKey ??
          days[0].dayKey);
  const [selectedKey, setSelectedKey] = useState(defaultSelected);
  const selected = days.find((d) => d.dayKey === selectedKey) ?? days[0];

  const weekdayLabels = [1, 2, 3, 4, 5, 6, 7].map((n) => t(`wd${n}`));

  return (
    <div className="flex flex-col gap-4">
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
            const isToday = day.dayKey === todayKey;
            const isSelected =
              mode === "interactive" && day.dayKey === selectedKey;
            const hasDone =
              day.sessions.length > 0 ||
              day.planned.some(
                (p) => p.status === "done" || p.status === "shifted",
              );
            const hasPlanned = day.planned.some(
              (p) =>
                p.status === "upcoming" ||
                p.status === "pending" ||
                p.status === "missed",
            );
            const hasClass = day.classes.length > 0;
            const dayNumber = Number(day.dayKey.slice(8));

            const cell = (
              <span
                className={cn(
                  "flex min-h-11 w-full flex-col items-center justify-center gap-1 rounded-xl py-1 text-sm transition-colors",
                  inMonth(day.dayKey) ? "text-neutral-800" : "text-neutral-300",
                  isToday &&
                    !isSelected &&
                    "bg-accent-soft font-bold text-accent",
                  isSelected && "bg-accent font-bold text-accent-foreground",
                  !isSelected && !isToday && hasContent(day) && "bg-surface-2",
                )}
              >
                {dayNumber}
                <span className="flex h-1.5 items-center gap-0.5">
                  {hasDone ? (
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        isSelected ? "bg-accent-foreground" : "bg-accent",
                      )}
                    />
                  ) : null}
                  {hasPlanned ? (
                    <span
                      className={cn(
                        "size-1.5 rounded-full border",
                        isSelected
                          ? "border-accent-foreground/70"
                          : "border-accent/60",
                      )}
                    />
                  ) : null}
                  {hasClass ? (
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        isSelected ? "bg-accent-foreground/80" : "bg-sky-400",
                      )}
                    />
                  ) : null}
                </span>
              </span>
            );

            if (mode === "link") {
              return hasContent(day) ? (
                <Link
                  key={day.dayKey}
                  href={`${linkBase}?m=${monthKeyOfDayKey(day.dayKey)}&d=${day.dayKey}`}
                  className="active:opacity-70"
                >
                  {cell}
                </Link>
              ) : (
                <span key={day.dayKey}>{cell}</span>
              );
            }
            return (
              <button
                key={day.dayKey}
                type="button"
                onClick={() => setSelectedKey(day.dayKey)}
                aria-pressed={isSelected}
                className="active:opacity-70"
              >
                {cell}
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-neutral-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-accent" />{" "}
            {t("legendDone")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-1.5 rounded-full border border-accent/60" />{" "}
            {t("legendPlanned")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-sky-400" />{" "}
            {t("legendClass")}
          </span>
        </div>
      </div>

      {/* Detailpaneel van de geselecteerde dag (alleen interactieve modus). */}
      {mode === "interactive" ? (
        !monthHasContent && !hasContent(selected) ? (
          <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-border bg-surface-0 px-6 py-10 text-center">
            <span className="text-3xl">🗓️</span>
            <p className="font-semibold text-neutral-900">{t("emptyTitle")}</p>
            <p className="max-w-sm text-sm text-neutral-500">
              {t("emptyDesc")}
            </p>
          </div>
        ) : (
          <AgendaDayDetail
            day={selected}
            todayKey={todayKey}
            timeZone={timeZone}
          />
        )
      ) : null}
    </div>
  );
}
