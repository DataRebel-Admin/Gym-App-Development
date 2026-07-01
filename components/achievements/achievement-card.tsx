import { cn } from "@/lib/cn";
import { Check } from "@/components/ui/icons";
import { rarityMeta } from "@/lib/achievements/rarity";
import type { AchievementItem } from "@/lib/achievements/evaluate";
import { AchievementBadge } from "@/components/achievements/achievement-badge";

const DATE_FMT = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short", year: "numeric" });

/** Kaart voor één trofee — behaald (met datum) of vergrendeld (met voortgang). */
export function AchievementCard({ item }: { item: AchievementItem }) {
  const { def, earned, earnedAt, progress } = item;
  const meta = rarityMeta(def.rarity);
  const pct = Math.round(progress * 100);

  return (
    <div
      className={cn(
        "relative flex flex-col gap-3 rounded-2xl border p-4 shadow-sm transition-colors",
        earned ? "border-border bg-surface-1" : "border-border bg-surface-0"
      )}
    >
      <div className="flex items-start gap-3">
        <AchievementBadge icon={def.icon} rarity={def.rarity} earned={earned} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3
              className={cn(
                "truncate font-display text-base font-bold",
                earned ? "text-neutral-900" : "text-neutral-500"
              )}
            >
              {def.title}
            </h3>
          </div>
          <p className="mt-0.5 line-clamp-2 text-sm text-neutral-500">{def.description}</p>
          <span
            className={cn(
              "mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
              meta.chip
            )}
          >
            {meta.label}
          </span>
        </div>
      </div>

      {earned ? (
        <div className="flex items-center gap-1.5 text-xs font-medium text-green-600">
          <Check className="size-4" />
          Behaald{earnedAt ? ` op ${DATE_FMT.format(earnedAt)}` : ""}
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between text-xs text-neutral-500">
            <span className="tabular-nums">
              {item.currentLabel} / {item.targetLabel}
            </span>
            <span className="font-semibold tabular-nums text-neutral-700">{pct}%</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-200">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, backgroundColor: meta.ring }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
