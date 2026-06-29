import { z } from "zod";

/** Alle beschikbare owner-dashboard widgets. */
export const WIDGET_IDS = [
  "kpis",
  "weekday-chart",
  "week-chart",
  "top-machines",
  "bottom-machines",
  "recent-activity",
  "quick-actions",
] as const;

export type WidgetId = (typeof WIDGET_IDS)[number];

export type WidgetConfig = { id: WidgetId; visible: boolean };
export type DashboardLayout = { widgets: WidgetConfig[] };

/** Metadata per widget (titel + breedte in het 2-koloms grid). */
export const WIDGET_META: Record<
  WidgetId,
  { title: string; span: 1 | 2 }
> = {
  kpis: { title: "Kerncijfers", span: 2 },
  "weekday-chart": { title: "Sessies per weekdag", span: 1 },
  "week-chart": { title: "Sessies per week", span: 1 },
  "top-machines": { title: "Top 5 machines", span: 1 },
  "bottom-machines": { title: "Minst gebruikt", span: 1 },
  "recent-activity": { title: "Recente activiteit", span: 1 },
  "quick-actions": { title: "Snelkoppelingen", span: 1 },
};

/** Standaard-indeling wanneer een gebruiker nog niets heeft opgeslagen. */
export const DEFAULT_LAYOUT: DashboardLayout = {
  widgets: WIDGET_IDS.map((id) => ({ id, visible: true })),
};

const layoutSchema = z.object({
  widgets: z
    .array(
      z.object({
        id: z.enum(WIDGET_IDS),
        visible: z.boolean(),
      })
    )
    .max(WIDGET_IDS.length),
});

/**
 * Valideert + normaliseert een opgeslagen layout: onbekende ids worden
 * genegeerd en ontbrekende widgets achteraan toegevoegd (zichtbaar), zodat
 * nieuwe widgets vanzelf verschijnen voor bestaande gebruikers.
 */
export function normalizeLayout(raw: unknown): DashboardLayout {
  const parsed = layoutSchema.safeParse(raw);
  if (!parsed.success) return DEFAULT_LAYOUT;

  const seen = new Set<WidgetId>();
  const widgets: WidgetConfig[] = [];
  for (const w of parsed.data.widgets) {
    if (seen.has(w.id)) continue;
    seen.add(w.id);
    widgets.push(w);
  }
  for (const id of WIDGET_IDS) {
    if (!seen.has(id)) widgets.push({ id, visible: true });
  }
  return { widgets };
}

export const dashboardLayoutSchema = layoutSchema;
