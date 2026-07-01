import { getSchemaBadge, parseBadges } from "@/lib/schema-badges";

/**
 * Toont de badges van een trainingsschema (⭐ Beginner, 🔥 Spieropbouw, ⚡
 * Intensief, …) als kleurige chips. Gedeeld door de bibliotheek, de member-
 * schemapagina, het dashboard en de detail-/keuze-weergaven. Rendert niets als
 * er geen (geldige) badges zijn. Zusje van GoalBadge.
 */
export function SchemaBadges({
  badges,
  size = "sm",
  max,
}: {
  badges: unknown;
  size?: "sm" | "xs";
  max?: number;
}) {
  const keys = parseBadges(badges);
  if (keys.length === 0) return null;
  const shown = max ? keys.slice(0, max) : keys;
  const pad = size === "xs" ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-0.5 text-xs";

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {shown.map((key) => {
        const def = getSchemaBadge(key);
        if (!def) return null;
        const Icon = def.icon;
        return (
          <span
            key={key}
            className={`inline-flex items-center gap-1 rounded-full font-medium ${pad} ${def.tone}`}
          >
            <Icon className="h-3 w-3" aria-hidden />
            {def.label}
          </span>
        );
      })}
      {max && keys.length > max ? (
        <span className={`inline-flex items-center rounded-full bg-surface-2 font-medium text-neutral-500 ${pad}`}>
          +{keys.length - max}
        </span>
      ) : null}
    </span>
  );
}
