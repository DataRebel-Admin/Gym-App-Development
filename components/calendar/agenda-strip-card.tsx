"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { formatTimeRange } from "@/lib/datetime";
import { monthKeyOfDayKey } from "@/lib/calendar-plan";
import { CalendarDays, ChevronRight, Play } from "@/components/ui/icons";
import { DragScroll } from "@/components/ui/drag-scroll";
import { Modal } from "@/components/ui/modal";
import {
  AgendaDayDetail,
  dayHeading,
} from "@/components/calendar/agenda-day-detail";
import { startSession } from "@/app/member/schema/actions";
import { StartSessionButton } from "@/app/member/schema/start-session-button";
import type { AgendaStrip } from "@/lib/calendar";

/**
 * Dashboard-widget "Volgende training": de eerstvolgende geplande schema-dag of
 * les, met daaronder een horizontaal scrollbare strip van losse dagblokjes
 * (vandaag + komende dagen, scroll-snap). Een tik op een blokje opent het
 * detail van die dag in een overlay (`Modal`, bewust géén uitklap onder de
 * strip — besluit eigenaar) met hetzelfde `AgendaDayDetail` als op de
 * agendapagina, zodat je snel even kijkt zonder de homepage te verlaten.
 * Vanuit de overlay linkt "Bekijk in agenda" naar de volledige agenda met die
 * dag voorgeselecteerd.
 * Is de volgende training een geplande dag van vandaag (van het actieve
 * schema), dan staat er een directe startknop: form → `startSession` met de
 * dag-id, een lopende sessie wordt hervat.
 */

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function utcOf(dayKey: string): Date {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function AgendaStripCard({ strip }: { strip: AgendaStrip }) {
  const t = useTranslations("member.home");
  const locale = useLocale();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const openDay = openKey
    ? (strip.days.find((d) => d.dayKey === openKey) ?? null)
    : null;
  const wdFmt = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    timeZone: "UTC",
  });
  const dateFmt = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });

  function relLabel(dayKey: string): string {
    if (dayKey === strip.todayKey) return t("relToday");
    const diff =
      (utcOf(dayKey).getTime() - utcOf(strip.todayKey).getTime()) / 86_400_000;
    if (diff === 1) return t("relTomorrow");
    return dateFmt.format(utcOf(dayKey));
  }

  const next = strip.nextUp;
  const headline =
    next === null
      ? t("nextNoneTitle")
      : next.kind === "training"
        ? next.dayName
        : next.title;
  const sub =
    next === null
      ? t("nextNoneDesc")
      : next.kind === "training"
        ? relLabel(next.dayKey)
        : `${relLabel(next.dayKey)} · ${formatTimeRange(
            new Date(next.startIso),
            new Date(next.endIso),
            next.timezone,
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

      {next?.kind === "training" &&
      next.startable &&
      next.dayKey === strip.todayKey ? (
        <form action={startSession} className="mt-3">
          <input type="hidden" name="dayId" value={next.dayId} />
          <StartSessionButton
            label={t("startTraining")}
            pendingLabel={t("starting")}
            className="justify-center px-4 py-3"
          >
            <span className="flex w-full items-center justify-center gap-2 text-base">
              <Play className="size-5 fill-current" /> {t("startTraining")}
            </span>
          </StartSessionButton>
        </form>
      ) : null}

      {/* Dagenstrip: blijft binnen de kaartinhoud (geen bleed tot de kaartrand),
          zodat de blokjes links en rechts exact op de kop, de tekst en de
          pagina-marge uitlijnen, ook halverwege het scrollen. Swipen/slepen
          zonder zichtbare scrollbalk (DragScroll regelt muis-slepen + verbergt
          de balk); scroll-snap zet elk blokje weer op diezelfde lijn.
          GEEF DEZE STRIP NOOIT PADDING (of een `-mx-*`/`px-*`-bleed tot de
          kaartrand) ZONDER EEN GELIJKE `scroll-px-*`: `snap-start` lijnt uit op
          de snapport, en die negeert padding. De eerste snappositie werd
          daardoor `scrollLeft = 20` i.p.v. 0, en `snap-mandatory` sprong daar
          bij het laden meteen heen — vandaag stond dan klemgeknipt tegen de
          kaartrand, uit lijn met de kop en de startknop, en pas na handmatig
          naar links slepen (DragScroll zet snap tijdens het slepen uit) op z'n
          plek. */}
      <DragScroll className="mt-3 flex snap-x snap-mandatory gap-2">
        {strip.days.map((day) => {
          const isToday = day.dayKey === strip.todayKey;
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
          const hasClass = day.classes.some((c) => !c.cancelled);
          return (
            <button
              key={day.dayKey}
              type="button"
              onClick={() => setOpenKey(day.dayKey)}
              aria-haspopup="dialog"
              aria-label={dateFmt.format(utcOf(day.dayKey))}
              className={cn(
                "flex w-14 shrink-0 snap-start flex-col items-center gap-0.5 rounded-2xl border py-2.5 transition-colors",
                isToday
                  ? "border-accent bg-accent-soft"
                  : "border-border bg-surface-1 active:bg-surface-2",
              )}
            >
              <span className="text-[10px] font-semibold uppercase text-neutral-400">
                {wdFmt.format(utcOf(day.dayKey))}
              </span>
              <span
                className={cn(
                  "text-base font-bold",
                  isToday ? "text-accent" : "text-neutral-800",
                )}
              >
                {Number(day.dayKey.slice(8))}
              </span>
              <span className="flex h-1.5 items-center gap-0.5">
                {hasDone ? (
                  <span className="size-1.5 rounded-full bg-accent" />
                ) : null}
                {hasPlanned ? (
                  <span className="size-1.5 rounded-full border border-accent/60" />
                ) : null}
                {hasClass ? (
                  <span className="size-1.5 rounded-full bg-sky-400" />
                ) : null}
              </span>
            </button>
          );
        })}
      </DragScroll>

      {/* Dag-overlay: snel kijken zonder de homepage te verlaten. De modal
          levert de titelbalk (datum + sluitknop), het paneel is dus `bare`. */}
      <Modal
        open={openDay !== null}
        onClose={() => setOpenKey(null)}
        title={
          openDay ? capitalize(dayHeading(openDay.dayKey, locale)) : undefined
        }
      >
        {openDay ? (
          <>
            {openDay.dayKey === strip.todayKey ? (
              <span className="mb-3 inline-block rounded-full bg-accent-soft px-2.5 py-0.5 text-[11px] font-semibold capitalize text-accent">
                {t("relToday")}
              </span>
            ) : null}
            <AgendaDayDetail
              bare
              day={openDay}
              todayKey={strip.todayKey}
              timeZone={strip.timeZone}
              footer={
                <Link
                  href={`/member/agenda?m=${monthKeyOfDayKey(openDay.dayKey)}&d=${openDay.dayKey}`}
                  className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-accent"
                >
                  {t("viewInAgenda")} <ChevronRight className="size-4" />
                </Link>
              }
            />
          </>
        ) : null}
      </Modal>
    </div>
  );
}
