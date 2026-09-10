"use client";

import { useTranslations } from "next-intl";
import { formatSessionStart, formatTimeRange } from "@/lib/datetime";
import { CalendarDays, Check, Clock, MapPin, Users } from "@/components/ui/icons";
import { ClassInfoButton } from "@/components/classes/class-info";
import { enroll, unenroll } from "@/app/member/rooster/actions";

/**
 * Eén groepsles-sessie zoals het lid hem ziet, met de aan-/afmeldknop.
 *
 * Client component omdat dezelfde kaart zowel in de lijst (server-render) als
 * in de dag-overlay van de kalender (`ClassCalendar`) staat; de knoppen blijven
 * gewone server-action-forms, dus aan-/afmelden werkt onveranderd zonder JS-
 * afhankelijke state.
 */
export type SessionCard = {
  id: string;
  /** Stabiele identiteit van het lestype (`GroupClass.id`) — de groepeersleutel. */
  classId: string;
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  locationId: string;
  /** Vestiging-naam (alleen gezet bij een multi-vestiging-organisatie). */
  venueName: string | null;
  location: string | null;
  className: string;
  description: string | null;
  instructorName: string | null;
  /** Eigen status: aangemeld, op de wachtlijst (met positie) of niets. */
  mine: "enrolled" | "waitlisted" | null;
  waitlistPosition: number | null;
  waitlistCount: number;
  full: boolean;
  started: boolean;
  /** Buiten de boekingshorizon van de sportschool: nog niet aan te melden. */
  tooEarly: boolean;
  /** Mag deze aanmelding nu nog ingetrokken worden (annuleerdeadline)? */
  canCancel: boolean;
  /** Minuten vóór de start waarin afmelden dichtgaat (0 = tot de start). */
  cancelDeadlineMinutes: number;
  /** Geannuleerd door de sportschool: zichtbaar als mededeling, geen acties. */
  cancelled: boolean;
  /** Al voorbij: komt alleen in de agenda-weergave voorbij (terugkijken). */
  past: boolean;
  spotsLeft: number;
  count: number;
  max: number;
};

export function ClassCard({ s, q }: { s: SessionCard; q: string }) {
  const t = useTranslations("member.rooster");
  const highlighted = s.mine !== null;
  return (
    <div
      className={`rounded-2xl border p-4 shadow-sm ${
        highlighted ? "border-accent ring-1 ring-accent/20 bg-accent-soft" : "border-border bg-surface-1"
      } ${s.past ? "opacity-70" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-1">
          <div className="min-w-0">
            <p className="font-display text-base font-bold text-neutral-900">{s.className}</p>
            {s.instructorName ? (
              <p className="text-xs text-neutral-500">{t("withInstructor", { name: s.instructorName })}</p>
            ) : null}
          </div>
          {/* De omschrijving van het lestype zit achter dit icoon en niet meer
              als alinea in de kaart: hetzelfde lestype staat vaak meerdere
              keren per week in de lijst. */}
          <ClassInfoButton name={s.className} description={s.description} align="start" />
        </div>
        {s.cancelled ? (
          <span className="shrink-0 rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-semibold text-red-700">
            {t("cancelled")}
          </span>
        ) : s.mine === "enrolled" ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-[11px] font-bold text-accent-foreground">
            <Check className="size-3" /> {t("enrolled")}
          </span>
        ) : s.mine === "waitlisted" ? (
          <span className="shrink-0 rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-semibold text-sky-800">
            {s.waitlistPosition ? t("waitlistPosition", { position: s.waitlistPosition }) : t("waitlisted")}
          </span>
        ) : s.past ? (
          <span className="shrink-0 rounded-full bg-neutral-200 px-2.5 py-1 text-[11px] font-semibold text-neutral-500">
            {t("past")}
          </span>
        ) : s.started ? (
          <span className="shrink-0 rounded-full bg-neutral-200 px-2.5 py-1 text-[11px] font-semibold text-neutral-500">
            {t("started")}
          </span>
        ) : s.tooEarly ? (
          <span className="shrink-0 rounded-full bg-neutral-200 px-2.5 py-1 text-[11px] font-semibold text-neutral-500">
            {t("tooEarly")}
          </span>
        ) : s.full ? (
          <span className="shrink-0 rounded-full bg-neutral-200 px-2.5 py-1 text-[11px] font-semibold text-neutral-500">
            {t("full")}
          </span>
        ) : (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-neutral-600">
            <Users className="size-3" /> {t("spotsLeft", { count: s.spotsLeft })}
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-neutral-600">
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays className="size-4 text-accent" />
          <span className="capitalize">{formatSessionStart(s.startsAt, s.timezone)}</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock className="size-4 text-accent" />
          {formatTimeRange(s.startsAt, s.endsAt, s.timezone)}
        </span>
        {s.venueName || s.location ? (
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="size-4 text-accent" />
            {[s.venueName, s.location].filter(Boolean).join(" · ")}
          </span>
        ) : null}
        {s.full && s.waitlistCount > 0 && s.mine === null ? (
          <span className="text-xs text-neutral-500">{t("waitlistCount", { count: s.waitlistCount })}</span>
        ) : null}
      </div>

      <div className="mt-3.5">
        {s.cancelled || s.past ? null : s.mine !== null ? (
          s.started ? null : s.canCancel ? (
            <form action={unenroll}>
              <input type="hidden" name="sessionId" value={s.id} />
              <input type="hidden" name="q" value={q} />
              <button
                type="submit"
                className="w-full rounded-xl border border-border bg-surface-1 px-4 py-2.5 text-sm font-semibold text-neutral-700 active:bg-surface-2"
              >
                {s.mine === "waitlisted" ? t("leaveWaitlist") : t("unenroll")}
              </button>
            </form>
          ) : (
            // De afmeldtermijn is verstreken: geen knop die de server toch
            // weigert, maar de reden.
            <p className="rounded-xl bg-surface-2 px-4 py-2.5 text-center text-sm font-medium text-neutral-500">
              {t("cancelClosed")}
            </p>
          )
        ) : s.started ? (
          <button
            type="button"
            disabled
            className="w-full rounded-xl bg-surface-2 px-4 py-2.5 text-sm font-semibold text-neutral-400"
          >
            {t("started")}
          </button>
        ) : s.tooEarly ? (
          <button
            type="button"
            disabled
            className="w-full rounded-xl bg-surface-2 px-4 py-2.5 text-sm font-semibold text-neutral-400"
          >
            {t("tooEarly")}
          </button>
        ) : (
          <form action={enroll}>
            <input type="hidden" name="sessionId" value={s.id} />
            <input type="hidden" name="q" value={q} />
            <button
              type="submit"
              className={`w-full rounded-xl px-4 py-2.5 text-sm font-bold active:opacity-90 ${
                s.full
                  ? "border border-accent bg-surface-1 text-accent"
                  : "bg-accent text-accent-foreground"
              }`}
            >
              {s.full ? t("joinWaitlist") : t("enroll")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
