import { cn } from "@/lib/cn";
import { rarityMeta } from "@/lib/achievements/rarity";
import type { PassportStamp as Stamp } from "@/lib/achievements/passport";

const DATE_FMT = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short", year: "numeric" });

/** Eén stempel in het Gym Passport — behaald (gekleurd) of nog te behalen (vaag). */
export function PassportStamp({ stamp }: { stamp: Stamp }) {
  const { def, earned, earnedAt } = stamp;
  const meta = rarityMeta(def.rarity);

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 rounded-2xl border p-4 text-center transition-opacity",
        earned ? "border-border bg-surface-1 shadow-sm" : "border-dashed border-neutral-300 bg-surface-0"
      )}
    >
      <span
        className={cn(
          "flex size-16 items-center justify-center rounded-full ring-2",
          earned
            ? cn(meta.gradient, "ring-white/40 shadow-md")
            : "bg-neutral-100 ring-neutral-200"
        )}
      >
        <def.icon
          className={cn("size-7", earned ? meta.onGradient : "text-neutral-300")}
          strokeWidth={1.9}
        />
      </span>
      <span
        className={cn(
          "text-xs font-semibold leading-tight",
          earned ? "text-neutral-900" : "text-neutral-400"
        )}
      >
        {def.title}
      </span>
      <span className={cn("text-[10px]", earned ? "text-neutral-500" : "text-neutral-400")}>
        {earned ? (earnedAt ? DATE_FMT.format(earnedAt) : "Behaald") : "Nog te behalen"}
      </span>
    </div>
  );
}
