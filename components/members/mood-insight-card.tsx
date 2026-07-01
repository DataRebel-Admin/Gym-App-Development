import type { MemberMoodInsight } from "@/lib/member-insights";
import { getMood } from "@/lib/workout-moods";

const DATETIME_FMT = new Intl.DateTimeFormat("nl-NL", {
  day: "numeric",
  month: "short",
});

/**
 * Coach-inzicht in de trainingsbeleving van een lid: gemiddelde, laatste mood,
 * mini-trend en een signaal bij meerdere zware trainingen op rij. Server-agnostisch
 * (krijgt geserialiseerde data uit lib/member-insights.ts).
 */
export function MoodInsightCard({ insight }: { insight: MemberMoodInsight }) {
  const avg = getMood(insight.averageMood);
  const last = getMood(insight.lastMood);

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-surface-1 p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-900">Trainingsbeleving</h2>
        <span className="text-xs text-neutral-500">
          {insight.count === 0
            ? "nog geen data"
            : `${insight.count} ${insight.count === 1 ? "training" : "trainingen"}`}
        </span>
      </div>

      {insight.count === 0 ? (
        <p className="text-sm text-neutral-500">
          Dit lid heeft nog geen trainingsbeleving gedeeld.
        </p>
      ) : (
        <>
          {/* Meerdere zware trainingen op rij → signaal voor de coach. */}
          {insight.concernStreak >= 2 ? (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
              <span className="text-base leading-none">⚠️</span>
              <span>
                {insight.concernStreak} zware trainingen op rij — overweeg contact op te nemen
                of het schema bij te sturen.
              </span>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border px-4 py-3">
              <p className="text-xs text-neutral-500">Gemiddeld</p>
              <p className="mt-1 flex items-center gap-2">
                <span className="text-2xl leading-none">{avg?.emoji ?? "—"}</span>
                <span className="font-display text-lg font-bold text-neutral-900">
                  {insight.averageScore != null ? `${insight.averageScore}/5` : "—"}
                </span>
              </p>
              {avg ? <p className="mt-0.5 text-xs text-neutral-500">{avg.label}</p> : null}
            </div>
            <div className="rounded-xl border border-border px-4 py-3">
              <p className="text-xs text-neutral-500">Laatste</p>
              <p className="mt-1 flex items-center gap-2">
                <span className="text-2xl leading-none">{last?.emoji ?? "—"}</span>
                <span className="font-medium text-neutral-900">{last?.label ?? "—"}</span>
              </p>
              {insight.lastAt ? (
                <p className="mt-0.5 text-xs text-neutral-500">
                  {DATETIME_FMT.format(new Date(insight.lastAt))}
                </p>
              ) : null}
            </div>
          </div>

          {/* Mini-trend (oud → nieuw). */}
          {insight.trend.length > 1 ? (
            <div>
              <p className="mb-1.5 text-xs text-neutral-500">Ontwikkeling</p>
              <div className="flex flex-wrap items-center gap-1">
                {insight.trend.map((p, i) => (
                  <span
                    key={`${p.at}-${i}`}
                    className="text-xl leading-none"
                    title={`${getMood(p.mood)?.label ?? p.mood} · ${DATETIME_FMT.format(new Date(p.at))}`}
                  >
                    {p.emoji}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
