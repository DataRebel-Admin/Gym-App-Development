import { z } from "zod";

/**
 * Alle configureerbare owner-dashboard widgets (verplaatsbaar/verbergbaar in het
 * grid). De snelkoppelingen zijn bewust **geen** widget meer: dat zijn vaste
 * navigatie-shortcuts die als altijd-zichtbare actiebalk bovenaan het dashboard
 * staan (zie `app/owner/page.tsx`), niet iets om onderaan te verstoppen.
 */
export const WIDGET_IDS = [
  "kpis",
  "week-chart",
  "weekday-chart",
  "popular-exercises",
  "class-occupancy",
  "top-machines",
  "bottom-machines",
  "recent-activity",
] as const;

export type WidgetId = (typeof WIDGET_IDS)[number];

export type WidgetConfig = { id: WidgetId; visible: boolean };
export type DashboardLayout = { widgets: WidgetConfig[] };

function isWidgetId(id: string): id is WidgetId {
  return (WIDGET_IDS as readonly string[]).includes(id);
}

/** Metadata per widget (titel + breedte in het 2-koloms grid). */
export const WIDGET_META: Record<
  WidgetId,
  { title: string; span: 1 | 2 }
> = {
  kpis: { title: "Kerncijfers", span: 2 },
  "week-chart": { title: "Groei — sessies per week", span: 2 },
  "weekday-chart": { title: "Sessies per weekdag", span: 1 },
  "popular-exercises": { title: "Populaire oefeningen", span: 1 },
  "class-occupancy": { title: "Lesbezetting", span: 1 },
  "top-machines": { title: "Top 5 machines", span: 1 },
  "bottom-machines": { title: "Minst gebruikt", span: 1 },
  "recent-activity": { title: "Recente activiteiten", span: 1 },
};

/** Standaard-indeling wanneer een gebruiker nog niets heeft opgeslagen. */
export const DEFAULT_LAYOUT: DashboardLayout = {
  widgets: WIDGET_IDS.map((id) => ({ id, visible: true })),
};

/**
 * Strikte layout (voor **opslaan**): alleen bestaande widget-ids zijn geldig.
 * De client stuurt nooit iets anders — de grid rendert enkel `WIDGET_IDS`.
 */
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
 * Losse (voor **lezen** uit de DB): id is een vrije string. Een layout die nog
 * een verwijderde widget bevat (bv. het oude "quick-actions") mag de héle
 * opgeslagen indeling niet resetten — onbekende ids strippen we in
 * `normalizeLayout`.
 */
const storedLayoutSchema = z.object({
  widgets: z
    .array(z.object({ id: z.string(), visible: z.boolean() }))
    .max(64),
});

/**
 * Valideert + normaliseert een opgeslagen layout: onbekende/verwijderde ids
 * worden weggelaten en ontbrekende widgets achteraan toegevoegd (zichtbaar),
 * zodat nieuwe widgets vanzelf verschijnen én verwijderde de indeling niet breken.
 */
export function normalizeLayout(raw: unknown): DashboardLayout {
  const parsed = storedLayoutSchema.safeParse(raw);
  if (!parsed.success) return DEFAULT_LAYOUT;

  const seen = new Set<WidgetId>();
  const widgets: WidgetConfig[] = [];
  for (const w of parsed.data.widgets) {
    if (!isWidgetId(w.id) || seen.has(w.id)) continue;
    seen.add(w.id);
    widgets.push({ id: w.id, visible: w.visible });
  }
  for (const id of WIDGET_IDS) {
    if (!seen.has(id)) widgets.push({ id, visible: true });
  }
  return { widgets };
}

export const dashboardLayoutSchema = layoutSchema;
