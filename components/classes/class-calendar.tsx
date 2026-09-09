"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { monthGridDayKeys, monthKeyOfDayKey } from "@/lib/calendar-plan";
import { ChevronLeft, ChevronRight } from "@/components/ui/icons";
import { Modal } from "@/components/ui/modal";
import { ClassCard, type SessionCard } from "@/components/classes/class-card";

/**
 * Maandkalender van het lesaanbod op /member/rooster: per dag hoeveel lessen er
 * staan en of het lid er zelf bij is. Bewust een eigen, simpele kalender naast
 * `components/calendar/agenda-calendar.tsx` — die toont de persoonlijke agenda
 * (trainingen, geplande dagen, eigen aanmeldingen) en hangt aan de
 * `AgendaMonth`-typen; hier gaat het om het aanbod van de sportschool.
 *
 * EEN TIK OP EEN DAG OPENT EEN OVERLAY, GEEN UITKLAP ERONDER (besluit
 * eigenaar) — hetzelfde patroon als de dagenstrip op /member
 * (`components/calendar/agenda-strip-card.tsx`). Dat is bewust volledig
 * client-side state: de dagkeuze liep eerst via `?d=` en dus via een
 * navigatie, waardoor de pagina bij élke tik naar boven sprong en de lijst
 * onder de kalender uit beeld schoof. De aanmeldknop blijft een gewone
 * server-action-form (in `ClassCard`), dus aan-/afmelden verandert niet.
 *
 * De maandnavigatie blijft wél een echte link (andere maand = andere data),
 * maar met `scroll={false}` zodat je op je plek in de pagina blijft.
 */

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function ClassCalendar({
  monthKey,
  todayKey,
  counts,
  mineDays,
  sessionsByDay,
  initialDayKey,
  formQuery,
  monthTitle,
  weekdayLabels,
  prevHref,
  nextHref,
  prevLabel,
  nextLabel,
}: {
  monthKey: string;
  todayKey: string;
  /** Aantal lessen per dagsleutel, ná de actieve filters. */
  counts: Record<string, number>;
  /** Dagen waarop het lid zelf is aangemeld of op de wachtlijst staat. */
  mineDays: Record<string, boolean>;
  /** De lessen zelf, per dagsleutel — voedt de overlay. */
  sessionsByDay: Record<string, SessionCard[]>;
  /** Dag uit de URL (`?d=`): opent die dag meteen, voor deelbare links. */
  initialDayKey: string | null;
  /** Query die aan-/afmelden meeneemt zodat je terugkomt in dezelfde weergave. */
  formQuery: string;
  monthTitle: string;
  /** Ma t/m zo, in de taal van het lid (hergebruikt `member.agenda.wd1..7`). */
  weekdayLabels: string[];
  prevHref: string;
  nextHref: string;
  prevLabel: string;
  nextLabel: string;
}) {
  const t = useTranslations("member.rooster");
  const locale = useLocale();
  const days = monthGridDayKeys(monthKey);
  const [openKey, setOpenKey] = useState<string | null>(initialDayKey);
  const openSessions = openKey ? (sessionsByDay[openKey] ?? []) : [];

  const dayFmt = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
  const dayTitle = (dayKey: string) =>
    capitalize(dayFmt.format(new Date(`${dayKey}T12:00:00Z`)));

  return (
    <div className="rounded-3xl border border-border bg-surface-1 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <Link
          href={prevHref}
          scroll={false}
          aria-label={prevLabel}
          className="flex size-9 items-center justify-center rounded-xl border border-border text-neutral-600 active:bg-surface-2"
        >
          <ChevronLeft className="size-5" />
        </Link>
        <p className="font-display text-base font-bold capitalize text-neutral-900">{monthTitle}</p>
        <Link
          href={nextHref}
          scroll={false}
          aria-label={nextLabel}
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
        {days.map((dayKey) => {
          const inMonth = monthKeyOfDayKey(dayKey) === monthKey;
          const count = counts[dayKey] ?? 0;
          const isToday = dayKey === todayKey;
          const isSelected = dayKey === openKey;
          const mine = mineDays[dayKey] === true;
          // Max 3 stippen: meer zegt op een telefoon niets extra's.
          const dots = Math.min(count, 3);
          return (
            <button
              key={dayKey}
              type="button"
              onClick={() => setOpenKey(dayKey)}
              aria-haspopup="dialog"
              aria-label={dayTitle(dayKey)}
              className={`flex aspect-square flex-col items-center justify-center gap-1 rounded-xl text-sm transition-colors ${
                isSelected
                  ? "bg-accent font-bold text-accent-foreground"
                  : isToday
                    ? "bg-accent-soft font-bold text-neutral-900"
                    : inMonth
                      ? "text-neutral-700 active:bg-surface-2"
                      : "text-neutral-300"
              }`}
            >
              <span>{Number(dayKey.slice(8, 10))}</span>
              <span className="flex h-1.5 items-center gap-0.5">
                {Array.from({ length: dots }, (_, i) => (
                  <span
                    key={i}
                    className={`size-1.5 rounded-full ${
                      isSelected
                        ? "bg-accent-foreground/80"
                        : mine
                          ? "bg-accent"
                          : "bg-neutral-300"
                    }`}
                  />
                ))}
              </span>
            </button>
          );
        })}
      </div>

      {/* Dag-overlay: de lessen van die dag mét aanmeldknop. De modal levert de
          titelbalk (datum + sluitknop). */}
      <Modal
        open={openKey !== null}
        onClose={() => setOpenKey(null)}
        title={openKey ? dayTitle(openKey) : undefined}
      >
        {openSessions.length === 0 ? (
          <p className="py-2 text-center text-sm text-neutral-500">{t("dayEmpty")}</p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {openSessions.map((s) => (
              <ClassCard key={s.id} s={s} q={formQuery} />
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
