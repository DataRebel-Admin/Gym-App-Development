"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { formatTimeRange } from "@/lib/datetime";
import { getMood } from "@/lib/workout-moods";
import { monthKeyOfDayKey } from "@/lib/calendar-plan";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
} from "@/components/ui/icons";
import type { AgendaDay, AgendaMonth, AgendaPlannedRow } from "@/lib/calendar";

/**
 * Interactieve maandagenda (agenda-app-patroon): het raster blijft staan en de
 * aangetikte dag verschijnt direct in het detailpaneel eronder — géén
 * anker-sprongen of terugscrollen. Maandnavigatie blijft server-driven via
 * `?m=`-links.
 *
 * `mode="link"` (historie-preview): tikken navigeert naar de agenda-pagina met
 * de dag voorgeselecteerd (`?m=…&d=…`); er is dan geen detailpaneel.
 */

const MAX_ITEMS_SHOWN = 3;

/** Badge-stijl per geplande-dag-status. "missed" bewust subtiel, niet rood. */
const STATUS_STYLE: Record<AgendaPlannedRow["status"], string> = {
  done: "bg-accent text-accent-foreground",
  shifted: "bg-accent-soft text-accent",
  upcoming: "border border-accent/50 text-accent",
  pending: "bg-surface-2 text-neutral-500",
  missed: "bg-surface-2 text-neutral-400",
};

function dayHeading(dayKey: string, locale: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

function hasContent(day: AgendaDay): boolean {
  return day.planned.length > 0 || day.sessions.length > 0 || day.classes.length > 0;
}

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
  const locale = useLocale();
  const { monthKey, todayKey, timeZone, days } = agenda;

  const inMonth = (k: string) => monthKeyOfDayKey(k) === monthKey;
  const firstWithContent = days.find((d) => inMonth(d.dayKey) && hasContent(d))?.dayKey ?? null;
  const monthHasContent = firstWithContent !== null;
  const defaultSelected =
    initialDayKey && days.some((d) => d.dayKey === initialDayKey)
      ? initialDayKey
      : days.some((d) => d.dayKey === todayKey && inMonth(todayKey))
        ? todayKey
        : (firstWithContent ?? days.find((d) => inMonth(d.dayKey))?.dayKey ?? days[0].dayKey);
  const [selectedKey, setSelectedKey] = useState(defaultSelected);
  const selected = days.find((d) => d.dayKey === selectedKey) ?? days[0];

  const weekdayLabels = [1, 2, 3, 4, 5, 6, 7].map((n) => t(`wd${n}`));

  const statusLabel: Record<AgendaPlannedRow["status"], string> = {
    done: t("statusDone"),
    shifted: t("statusShifted"),
    upcoming: t("statusUpcoming"),
    pending: t("statusPending"),
    missed: t("statusMissed"),
  };

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
            const isSelected = mode === "interactive" && day.dayKey === selectedKey;
            const hasDone =
              day.sessions.length > 0 ||
              day.planned.some((p) => p.status === "done" || p.status === "shifted");
            const hasPlanned = day.planned.some(
              (p) => p.status === "upcoming" || p.status === "pending" || p.status === "missed"
            );
            const hasClass = day.classes.length > 0;
            const dayNumber = Number(day.dayKey.slice(8));

            const cell = (
              <span
                className={cn(
                  "flex min-h-11 w-full flex-col items-center justify-center gap-1 rounded-xl py-1 text-sm transition-colors",
                  inMonth(day.dayKey) ? "text-neutral-800" : "text-neutral-300",
                  isToday && !isSelected && "bg-accent-soft font-bold text-accent",
                  isSelected && "bg-accent font-bold text-accent-foreground",
                  !isSelected && !isToday && hasContent(day) && "bg-surface-2"
                )}
              >
                {dayNumber}
                <span className="flex h-1.5 items-center gap-0.5">
                  {hasDone ? (
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        isSelected ? "bg-accent-foreground" : "bg-accent"
                      )}
                    />
                  ) : null}
                  {hasPlanned ? (
                    <span
                      className={cn(
                        "size-1.5 rounded-full border",
                        isSelected ? "border-accent-foreground/70" : "border-accent/60"
                      )}
                    />
                  ) : null}
                  {hasClass ? (
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        isSelected ? "bg-accent-foreground/80" : "bg-sky-400"
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

      {/* Detailpaneel van de geselecteerde dag (alleen interactieve modus). */}
      {mode === "interactive" ? (
        !monthHasContent && !hasContent(selected) ? (
          <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-border bg-surface-0 px-6 py-10 text-center">
            <span className="text-3xl">🗓️</span>
            <p className="font-semibold text-neutral-900">{t("emptyTitle")}</p>
            <p className="max-w-sm text-sm text-neutral-500">{t("emptyDesc")}</p>
          </div>
        ) : (
          <section
            key={selected.dayKey}
            className="rounded-3xl border border-border bg-surface-1 p-4 shadow-sm"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-sm font-bold capitalize text-neutral-900">
                {dayHeading(selected.dayKey, locale)}
              </h2>
              {selected.dayKey === todayKey ? (
                <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-[11px] font-semibold text-accent">
                  {t("todayLabel")}
                </span>
              ) : null}
            </div>

            {!hasContent(selected) ? (
              <p className="mt-3 text-sm text-neutral-500">{t("dayEmpty")}</p>
            ) : (
              <div className="mt-3 flex flex-col gap-2.5">
                {/* Geplande schema-dagen */}
                {selected.planned.map((p) => (
                  <div
                    key={p.dayId}
                    className={cn(
                      "rounded-2xl border border-border p-3",
                      p.status === "missed" && "opacity-70"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="inline-flex min-w-0 items-center gap-1.5 text-sm font-semibold text-neutral-800">
                        <CalendarDays className="size-4 shrink-0 text-accent" />
                        <span className="truncate">{p.dayName}</span>
                      </p>
                      <span
                        className={cn(
                          "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                          STATUS_STYLE[p.status]
                        )}
                      >
                        {p.status === "done" ? <Check className="size-3" /> : null}
                        {statusLabel[p.status]}
                      </span>
                    </div>
                    {p.items.length > 0 ? (
                      <ul className="mt-1.5 flex flex-col gap-0.5 text-xs text-neutral-500">
                        {p.items.slice(0, MAX_ITEMS_SHOWN).map((it, i) => (
                          <li key={i} className="truncate">
                            {it.name}
                            {it.summary ? ` · ${it.summary}` : ""}
                          </li>
                        ))}
                        {p.items.length > MAX_ITEMS_SHOWN ? (
                          <li className="text-neutral-400">
                            {t("moreExercises", { count: p.items.length - MAX_ITEMS_SHOWN })}
                          </li>
                        ) : null}
                      </ul>
                    ) : null}
                  </div>
                ))}

                {/* Gedane trainingen */}
                {selected.sessions.map((s) => {
                  const start = new Date(s.startIso);
                  const end =
                    s.durationMin != null
                      ? new Date(start.getTime() + s.durationMin * 60_000)
                      : null;
                  const mood = getMood(s.mood);
                  return (
                    <div key={s.id} className="rounded-2xl bg-accent-soft p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="inline-flex min-w-0 items-center gap-1.5 text-sm font-semibold text-neutral-800">
                          <Check className="size-4 shrink-0 text-accent" />
                          <span className="truncate">
                            {s.dayName ?? t("sessionFallbackName")}
                          </span>
                        </p>
                        {mood ? (
                          <span className="shrink-0 text-base" title={mood.label}>
                            {mood.emoji}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-neutral-500">
                        <Clock className="size-3.5" />
                        {end ? formatTimeRange(start, end, timeZone) : null}
                        {s.durationMin != null
                          ? ` · ${t("durationMin", { count: s.durationMin })}`
                          : null}
                      </p>
                    </div>
                  );
                })}

                {/* Groepslessen */}
                {selected.classes.map((c) => (
                  <div
                    key={c.id}
                    className={cn(
                      "rounded-2xl border border-border p-3",
                      c.cancelled && "opacity-70"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className={cn(
                          "min-w-0 truncate text-sm font-semibold text-neutral-800",
                          c.cancelled && "line-through"
                        )}
                      >
                        {c.title}
                      </p>
                      {c.cancelled ? (
                        <span className="shrink-0 rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-semibold text-red-700">
                          {t("classCancelled")}
                        </span>
                      ) : c.status === "WAITLISTED" ? (
                        <span className="shrink-0 rounded-full bg-sky-100 px-2.5 py-0.5 text-[11px] font-semibold text-sky-800">
                          {t("classWaitlisted")}
                        </span>
                      ) : c.status === "ATTENDED" ? (
                        <span className="shrink-0 rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-bold text-accent-foreground">
                          {t("classAttended")}
                        </span>
                      ) : c.status === "NO_SHOW" ? (
                        <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px] font-semibold text-neutral-500">
                          {t("classNoShow")}
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-full bg-sky-100 px-2.5 py-0.5 text-[11px] font-semibold text-sky-800">
                          {t("classEnrolled")}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-neutral-500">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="size-3.5" />
                        {formatTimeRange(new Date(c.startIso), new Date(c.endIso), c.timezone)}
                      </span>
                      {c.venueName || c.room ? (
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="size-3.5" />
                          {[c.venueName, c.room].filter(Boolean).join(" · ")}
                        </span>
                      ) : null}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )
      ) : null}
    </div>
  );
}
