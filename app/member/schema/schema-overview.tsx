import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Info, TrendingDown } from "@/components/ui/icons";
import {
  groupItems,
  groupPositionLabel,
  groupSummary,
  type GroupFields,
} from "@/lib/exercise-groups";

/**
 * Read-only overzicht van het schema: wát je gaat doen. **Bewust géén afvinken** —
 * dat gebeurt tijdens de workout (`/member/schema/active`), waar het écht wordt
 * gelogd. Twee plekken afvinken was dubbel en de vinkjes hier waren toch
 * vluchtig (alleen client-state). Daardoor heeft dit component geen state meer
 * en is het een server-component; elke rij linkt naar de uitleg.
 */

export type OverviewItem = {
  id: string;
  /** Oefening-id → link naar de uitleg (/member/history/exercise/[id]). */
  exerciseId: string;
  exerciseName: string;
  machineName: string | null;
  /** Type-bewuste samenvatting ("4 × 10 @ 70 kg" of "30 min · 5 km · Zone 3"). */
  summary: string;
  typeLabel: string;
  notes: string | null;
  /** Per-lid coach-boodschap (alleen dit lid ziet dit). */
  memberNote: string | null;
  thumbUrl: string | null;
} & GroupFields;

export type OverviewDay = { name: string; notes: string | null; items: OverviewItem[] };

export async function SchemaOverview({
  items,
  days,
  coachNote,
}: {
  items?: OverviewItem[];
  days?: OverviewDay[];
  /**
   * Coach-notitie op schema-niveau (`WorkoutTemplate.coachNote`) — hoort bij het
   * schema en geldt voor elk lid dat het krijgt, dus staat 'ie hier bij het
   * programma. Het persoonlijke `trainerMessage` blijft bovenaan de pagina;
   * zo lijken de twee niet langer hetzelfde soort bericht.
   */
  coachNote?: string | null;
}) {
  const t = await getTranslations("member.program");

  // Normaliseer naar dagen (val terug op één naamloze "dag" voor platte lijsten).
  const groups: OverviewDay[] =
    days && days.length > 0 ? days : [{ name: "", notes: null, items: items ?? [] }];

  /**
   * Eén oefening-rij. `groupPos` ≥ 0 = binnen een superset/circuit (A/B/C-badge),
   * anders toont de rij z'n rangnummer binnen de dag.
   */
  function renderRow(it: OverviewItem, groupPos: number, index: number) {
    const grouped = groupPos >= 0;
    return (
      <li key={it.id} className="rounded-xl border border-border bg-surface-1">
        <Link
          href={`/member/history/exercise/${it.exerciseId}`}
          aria-label={`${t("explain")}: ${it.exerciseName}`}
          className={`flex items-center gap-3 rounded-xl px-4 py-3 text-left active:bg-surface-2 ${
            grouped ? "border-l-4 border-l-violet-300" : ""
          }`}
        >
          <span
            className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
              grouped
                ? "bg-violet-100 text-violet-600"
                : "bg-surface-2 text-neutral-500"
            }`}
            aria-hidden
          >
            {grouped ? groupPositionLabel(groupPos) : index + 1}
          </span>
          {it.thumbUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={it.thumbUrl}
              alt=""
              aria-hidden
              className="h-10 w-10 shrink-0 rounded-lg object-cover"
            />
          ) : null}
          <span className="flex-1">
            <span className="block font-medium text-neutral-900">
              {it.exerciseName}
              {(it.dropsetCount ?? 0) >= 1 ? (
                <span className="ml-1 inline-flex items-center gap-0.5 align-middle text-[11px] font-semibold text-rose-500">
                  <TrendingDown className="size-3" />×{it.dropsetCount}
                </span>
              ) : null}
            </span>
            <span className="block text-sm text-neutral-500">
              <span className="font-medium text-neutral-600">{it.typeLabel}</span>
              {it.summary && it.summary !== "—" ? ` · ${it.summary}` : ""}
              {it.machineName ? ` · ${it.machineName}` : ""}
            </span>
            {it.notes ? (
              <span className="mt-0.5 block text-xs text-neutral-500">{it.notes}</span>
            ) : null}
            {it.memberNote ? (
              <span className="mt-0.5 block text-xs font-medium text-accent">
                ✎ {it.memberNote}
              </span>
            ) : null}
          </span>
          <span
            className="flex shrink-0 flex-col items-center gap-0.5 text-neutral-400"
            aria-hidden
          >
            <Info className="size-5" />
            <span className="text-[10px] font-medium">{t("explain")}</span>
          </span>
        </Link>
      </li>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h2 className="font-display text-lg font-bold text-neutral-900">{t("title")}</h2>
        {coachNote ? (
          <div className="rounded-2xl border border-border bg-surface-1 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
              {t("schemaNote")}
            </p>
            <p className="mt-1 text-sm text-neutral-700">{coachNote}</p>
          </div>
        ) : null}
      </div>
      {groups.map((group, gi) => (
        <div key={gi} className="flex flex-col gap-2">
          {group.name ? (
            <h3 className="text-sm font-semibold text-neutral-900">{group.name}</h3>
          ) : null}
          {group.notes ? (
            <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-neutral-600">
              <span className="font-semibold text-accent">{t("tip")}</span>
              {group.notes}
            </p>
          ) : null}
          <ul className="flex flex-col gap-2">
            {(() => {
              // Doorlopende nummering binnen de dag, ook over groepen heen.
              let n = 0;
              return groupItems(group.items).map((g, ggi) => {
                const real = g.type != null && g.items.length >= 2;
                const rows = g.items.map((it, pos) => renderRow(it, real ? pos : -1, n++));
                if (!real || !g.type) return rows;
                const GIcon = g.type.icon;
                return (
                  <li
                    key={`g-${ggi}`}
                    className="rounded-xl border border-violet-200 bg-violet-50/40 p-2"
                  >
                    <p className="mb-1.5 flex items-center gap-1.5 px-1 text-[11px] font-semibold text-violet-600">
                      <GIcon className="size-3.5" /> {groupSummary(g)}
                    </p>
                    <ul className="flex flex-col gap-2">{rows}</ul>
                  </li>
                );
              });
            })()}
          </ul>
        </div>
      ))}
    </div>
  );
}
