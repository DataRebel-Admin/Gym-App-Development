"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { formatTimeRange } from "@/lib/datetime";
import { getMood } from "@/lib/workout-moods";
import {
  CalendarDays,
  Check,
  ChevronRight,
  Clock,
  MapPin,
  Play,
} from "@/components/ui/icons";
import { startSession } from "@/app/member/schema/actions";
import { StartSessionButton } from "@/app/member/schema/start-session-button";
import type { AgendaDay, AgendaPlannedRow } from "@/lib/calendar";

/**
 * Detailpaneel van één agenda-dag: geplande schema-dagen, gedane trainingen en
 * groepsles-aanmeldingen. Gedeeld door de maandagenda (/member/agenda) en de
 * dagenstrip op /member — één weergave, zodat een dag er overal hetzelfde
 * uitziet en een nieuw rijtype maar op één plek hoeft te landen.
 *
 * Doorklik naar de training: een geplande dag van het actieve schema start
 * vandaag direct (`startSession` met de dag-id, hervat een lopende sessie) en
 * linkt op andere dagen naar het schema; een gedane training linkt naar haar
 * rij in de historie. `footer` is een optionele extra regel onderaan (de
 * strip zet daar de link naar de volledige agenda). `bare` laat de eigen kaart
 * en datumkop weg — voor een container die zelf al een titelbalk heeft (de
 * dag-overlay op /member gebruikt de `Modal`-titel als kop).
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

export function dayHeading(dayKey: string, locale: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function hasContent(day: AgendaDay): boolean {
  return (
    day.planned.length > 0 || day.sessions.length > 0 || day.classes.length > 0
  );
}

export function AgendaDayDetail({
  day,
  todayKey,
  timeZone,
  footer = null,
  className,
  bare = false,
}: {
  day: AgendaDay;
  todayKey: string;
  timeZone: string;
  footer?: React.ReactNode;
  className?: string;
  bare?: boolean;
}) {
  const t = useTranslations("member.agenda");
  const locale = useLocale();
  const isToday = day.dayKey === todayKey;

  const statusLabel: Record<AgendaPlannedRow["status"], string> = {
    done: t("statusDone"),
    shifted: t("statusShifted"),
    upcoming: t("statusUpcoming"),
    pending: t("statusPending"),
    missed: t("statusMissed"),
  };

  const body = !hasContent(day) ? (
    <p className={cn("text-sm text-neutral-500", !bare && "mt-3")}>
      {t("dayEmpty")}
    </p>
  ) : (
    <div className={cn("flex flex-col gap-2.5", !bare && "mt-3")}>
      {/* Geplande schema-dagen */}
      {day.planned.map((p) => (
        <div
          key={p.dayId}
          className={cn(
            "rounded-2xl border border-border p-3",
            p.status === "missed" && "opacity-70",
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
                STATUS_STYLE[p.status],
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
                  {t("moreExercises", {
                    count: p.items.length - MAX_ITEMS_SHOWN,
                  })}
                </li>
              ) : null}
            </ul>
          ) : null}
          {/* Naar de training: vandaag direct starten, anders naar het schema.
                  Alleen voor het schema dat nú actief is; een al gedane dag
                  heeft haar sessiekaart hieronder. */}
          {p.startable && p.status !== "done" && p.status !== "shifted" ? (
            isToday ? (
              <form action={startSession} className="mt-3">
                <input type="hidden" name="dayId" value={p.dayId} />
                <StartSessionButton
                  label={t("startTraining")}
                  pendingLabel={t("starting")}
                  className="justify-center px-4 py-2.5"
                >
                  <span className="flex w-full items-center justify-center gap-2 text-sm">
                    <Play className="size-4 fill-current" />{" "}
                    {t("startTraining")}
                  </span>
                </StartSessionButton>
              </form>
            ) : (
              <Link
                href="/member/schema"
                className="mt-2.5 inline-flex items-center gap-1 text-xs font-semibold text-accent"
              >
                {t("openSchema")} <ChevronRight className="size-3.5" />
              </Link>
            )
          ) : null}
        </div>
      ))}

      {/* Gedane trainingen */}
      {day.sessions.map((s) => {
        const start = new Date(s.startIso);
        const end =
          s.durationMin != null
            ? new Date(start.getTime() + s.durationMin * 60_000)
            : null;
        const mood = getMood(s.mood);
        return (
          <Link
            key={s.id}
            href={`/member/history#sessie-${s.id}`}
            className="block rounded-2xl bg-accent-soft p-3 active:opacity-80"
          >
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
            <span className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-accent">
              {t("viewSession")} <ChevronRight className="size-3.5" />
            </span>
          </Link>
        );
      })}

      {/* Groepslessen */}
      {day.classes.map((c) => (
        <div
          key={c.id}
          className={cn(
            "rounded-2xl border border-border p-3",
            c.cancelled && "opacity-70",
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <p
              className={cn(
                "min-w-0 truncate text-sm font-semibold text-neutral-800",
                c.cancelled && "line-through",
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
              {formatTimeRange(
                new Date(c.startIso),
                new Date(c.endIso),
                c.timezone,
              )}
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
  );

  if (bare) {
    return (
      <>
        {body}
        {footer}
      </>
    );
  }

  return (
    <section
      key={day.dayKey}
      className={cn(
        "rounded-3xl border border-border bg-surface-1 p-4 shadow-sm",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-sm font-bold capitalize text-neutral-900">
          {dayHeading(day.dayKey, locale)}
        </h2>
        {isToday ? (
          <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-[11px] font-semibold text-accent">
            {t("todayLabel")}
          </span>
        ) : null}
      </div>
      {body}
      {footer}
    </section>
  );
}
