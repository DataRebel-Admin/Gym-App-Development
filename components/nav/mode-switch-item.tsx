"use client";

import { useTranslations } from "next-intl";
import { Dumbbell, LayoutDashboard, ChevronRight } from "@/components/ui/icons";
import { chooseMode } from "@/app/start/actions";

/**
 * "Naar mijn training" / "Naar beheer" — wisselen tussen de twee werelden van een
 * teamlid dat óók zelf sport. Alleen renderen als `bothModes` waar is
 * (lib/member-mode.ts); anders bestaat er niets om naar te wisselen.
 *
 * Bewust een form met een server-action en geen `<Link>`: de modus-cookie moet
 * mee, en die kan alleen in een action/route-handler gezet worden. De keuze geldt
 * voor deze sessie — bij de volgende koude app-start vraagt `/start` opnieuw.
 */
export function ModeSwitchItem({
  to,
  variant = "menu",
  onSubmit,
}: {
  to: "member" | "owner";
  /** "menu" = compacte dropdown-regel, "drawer" = brede zijmenu-regel. */
  variant?: "menu" | "drawer";
  /** Bv. het sluiten van een drawer/menu vóór de navigatie. */
  onSubmit?: () => void;
}) {
  const t = useTranslations("mode");
  const Icon = to === "member" ? Dumbbell : LayoutDashboard;
  const label = to === "member" ? t("switchToMember") : t("switchToOwner");

  return (
    <form action={chooseMode} onSubmit={onSubmit}>
      <input type="hidden" name="mode" value={to} />
      {variant === "drawer" ? (
        <button
          type="submit"
          className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-neutral-800 transition-colors hover:bg-surface-2"
        >
          <Icon className="size-5 text-accent" />
          <span className="flex-1 text-left">{label}</span>
          <ChevronRight className="size-4 text-neutral-300" />
        </button>
      ) : (
        <button
          type="submit"
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-neutral-700 transition-colors hover:bg-neutral-100"
        >
          <Icon size={16} className="shrink-0 text-neutral-500" />
          {label}
        </button>
      )}
    </form>
  );
}
