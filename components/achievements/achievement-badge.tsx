import { cn } from "@/lib/cn";
import { Lock, type LucideIcon } from "@/components/ui/icons";
import { rarityMeta } from "@/lib/achievements/rarity";

const SIZES = {
  sm: { box: "size-11", icon: "size-5", lock: "size-3.5" },
  md: { box: "size-16", icon: "size-7", lock: "size-5" },
  lg: { box: "size-24", icon: "size-11", lock: "size-7" },
} as const;

/**
 * Premium medaille-badge voor een trofee. Behaald = rariteit-gradient met gloed;
 * vergrendeld = neutraal + slotje. Puur presentational (server-compatible).
 */
export function AchievementBadge({
  icon: Icon,
  rarity,
  earned,
  size = "md",
  className,
}: {
  icon: LucideIcon;
  rarity: string;
  earned: boolean;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const meta = rarityMeta(rarity);
  const s = SIZES[size];

  return (
    <div className={cn("relative inline-flex shrink-0", className)}>
      {earned ? (
        <span
          aria-hidden
          className={cn("absolute inset-0 rounded-2xl blur-lg", meta.glow)}
        />
      ) : null}
      <span
        className={cn(
          "relative flex items-center justify-center rounded-2xl ring-1 ring-inset transition-transform",
          s.box,
          earned
            ? cn(meta.gradient, "shadow-md ring-white/40")
            : "bg-neutral-100 ring-neutral-200"
        )}
      >
        {earned ? (
          <Icon className={cn(s.icon, meta.onGradient)} strokeWidth={1.9} />
        ) : (
          <Lock className={cn(s.lock, "text-neutral-400")} strokeWidth={2} />
        )}
      </span>
    </div>
  );
}
