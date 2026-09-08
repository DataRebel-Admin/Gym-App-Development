import { useLocale, useTranslations } from "next-intl";
import { formatTimeRange } from "@/lib/datetime";
import { getMood } from "@/lib/workout-moods";
import { CalendarDays, Check, Clock, MapPin } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import type { AgendaDay, AgendaPlannedRow } from "@/lib/calendar";

/**
 * Daglijst onder het maandraster: per dag de geplande schema-dag(en) met
 * status, de gedane trainingen (duur + mood) en de groepsles-aanmeldingen.
 * Server component; alle data komt geserialiseerd uit lib/calendar.ts.
 * Lestijden staan in de tijdzone van de vestiging (repo-regel), sessies in de
 * lid-tijdzone van de agenda.
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

export function AgendaDayList({
  days,
  timeZone,
  todayKey,
}: {
  days: AgendaDay[];
  timeZone: string;
  todayKey: string;
}) {
  const t = useTranslations("member.agenda");
  const locale = useLocale();

  const statusLabel: Record<AgendaPlannedRow["status"], string> = {
    done: t("statusDone"),
    shifted: t("statusShifted"),
    upcoming: t("statusUpcoming"),
    pending: t("statusPending"),
    missed: t("statusMissed"),
  };

  return (
    <div className="flex flex-col gap-4">
      {days.map((day) => (
        <section
          key={day.dayKey}
          id={`d-${day.dayKey}`}
          className="scroll-mt-24 rounded-3xl border border-border bg-surface-1 p-4 shadow-sm"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-sm font-bold capitalize text-neutral-900">
              {dayHeading(day.dayKey, locale)}
            </h2>
            {day.dayKey === todayKey ? (
              <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-[11px] font-semibold text-accent">
                {t("todayLabel")}
              </span>
            ) : null}
          </div>

          <div className="mt-3 flex flex-col gap-2.5">
            {/* Geplande schema-dagen */}
            {day.planned.map((p) => (
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
            {day.sessions.map((s) => {
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
                      <span className="truncate">{s.dayName ?? t("sessionFallbackName")}</span>
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
                    {s.durationMin != null ? ` · ${t("durationMin", { count: s.durationMin })}` : null}
                  </p>
                </div>
              );
            })}

            {/* Groepslessen */}
            {day.classes.map((c) => (
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
        </section>
      ))}
    </div>
  );
}
