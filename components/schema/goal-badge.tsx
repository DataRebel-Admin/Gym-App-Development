import { getTrainingGoal } from "@/lib/training-goals";

/**
 * Neutraal trainingsdoel-chip — gedeeld door de template-lijst/detail (owner)
 * en het member-overzicht. Toont niets als er geen (geldig) doel is getagd.
 */
export function GoalBadge({
  goal,
  size = "sm",
}: {
  goal: string | null | undefined;
  size?: "sm" | "xs";
}) {
  const def = getTrainingGoal(goal);
  if (!def) return null;
  const Icon = def.icon;
  const pad = size === "xs" ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-0.5 text-xs";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${pad} ${def.tone}`}
      title={def.description}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {def.label}
    </span>
  );
}
