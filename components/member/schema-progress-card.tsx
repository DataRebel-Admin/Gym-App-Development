import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ProgressRing } from "@/components/ui/progress-ring";
import { CheckCircle2, ChevronRight, Clock } from "@/components/ui/icons";
import { daysAgo, type SchemaProgress } from "@/lib/schema-progress";

/**
 * "Jouw voortgang" op de schema-pagina — afgeleid uit **afgeronde workouts**,
 * niet uit handmatig afvinken (dat gebeurt alleen in de workout zelf).
 *
 * Multi-dag: hoeveel van je trainingsdagen je deze week hebt gedraaid (+ per dag
 * wanneer voor het laatst). Enkele dag: aantal workouts op dit schema + wanneer
 * de laatste was. Het weekdoel-percentage staat bewust op `/member` (dashboard) —
 * hier gaat het over dít schema.
 */
export async function SchemaProgressCard({
  progress,
  dayNames,
}: {
  progress: SchemaProgress;
  /** Naam per trainingsdag, in dezelfde volgorde als `progress.days`. */
  dayNames: string[];
}) {
  const t = await getTranslations("member.schema");
  const now = new Date();
  const multiDay = progress.days.length > 1;
  const total = progress.days.length;
  const done = progress.daysDoneThisWeek;
  const pct = multiDay && total > 0 ? Math.round((done / total) * 100) : 0;

  const last = daysAgo(progress.lastTrainedAt, now);
  const lastLabel =
    last === null ? t("progressNeverTrained") : t("progressLastTrained", { days: last });

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-1 p-4 shadow-sm">
      <div className="flex items-center gap-4">
        {multiDay ? (
          <ProgressRing value={pct} size={88} strokeWidth={9} label={`${done}/${total}`} />
        ) : (
          <div className="flex size-[88px] shrink-0 flex-col items-center justify-center rounded-full bg-accent-soft">
            <span className="font-display text-2xl font-bold text-accent">
              {progress.totalSessions}
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wide text-accent">
              {t("progressWorkoutsShort")}
            </span>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-bold text-neutral-900">
            {t("progressTitle")}
          </p>
          <p className="text-sm text-neutral-500">
            {multiDay
              ? t("progressDaysThisWeek", { done, total })
              : t("progressSessionsThisWeek", { count: progress.sessionsThisWeek })}
          </p>
          <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500">
            <Clock className="size-3.5 text-accent" /> {lastLabel}
          </p>
        </div>
      </div>

      {multiDay ? (
        <ul className="flex flex-col gap-1 border-t border-border pt-3">
          {progress.days.map((d, i) => {
            const ago = daysAgo(d.lastTrainedAt, now);
            return (
              <li
                key={d.dayId}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  <CheckCircle2
                    className={`size-4 shrink-0 ${
                      d.doneThisWeek ? "text-accent" : "text-neutral-300"
                    }`}
                    aria-hidden
                  />
                  <span className="truncate text-neutral-700">{dayNames[i]}</span>
                </span>
                <span className="shrink-0 text-xs text-neutral-500">
                  {ago === null ? t("progressDayNever") : t("progressDayLast", { days: ago })}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}

      <Link
        href="/member/progress"
        className="inline-flex items-center gap-1 text-sm font-semibold text-accent"
      >
        {t("progressViewAll")} <ChevronRight className="size-4" />
      </Link>
    </div>
  );
}
