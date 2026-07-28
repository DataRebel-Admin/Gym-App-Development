import type { LocationComparison } from "@/lib/metrics/queries";
import { NonAdditiveNote } from "@/components/insights/non-additive-note";

const WEEKDAYS = ["ma", "di", "wo", "do", "vr", "za", "zo"];

function pct(v: number | null): string {
  return v == null ? "—" : `${Math.round(v * 100)}%`;
}

/**
 * Vestigingsvergelijking voor de eigenaar (en de gescopede variant voor een
 * vestigingsmanager): actieve leden / bezoeken / retentie / no-shows / piek per
 * vestiging + (alleen org-scope) het geconsolideerde totaal. Vorm gekopieerd
 * van de tenant-vergelijking in lib/admin-dashboard.ts. Server component.
 */
export function LocationComparisonTable({ data }: { data: LocationComparison }) {
  if (data.rows.length === 0) {
    return (
      <p className="rounded-2xl border border-border bg-surface-1 px-4 py-6 text-center text-sm text-neutral-500">
        Je bent nog niet aan een vestiging gekoppeld — vraag de eigenaar om
        vestiging-toegang.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {data.orgTotals ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryCard label="Actieve leden (org)" value={String(data.orgTotals.activeMembers)} />
          <SummaryCard label="Bezoeken (org)" value={String(data.orgTotals.visits)} />
          <SummaryCard label="Retentie (org)" value={pct(data.orgTotals.retention)} />
          <SummaryCard label="No-show (org)" value={pct(data.orgTotals.noShowRate)} />
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-border bg-surface-1">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-neutral-400">
              <th className="px-4 py-3">Vestiging</th>
              <th className="px-4 py-3 text-right">Actieve leden</th>
              <th className="px-4 py-3 text-right">Bezoeken</th>
              <th className="px-4 py-3 text-right">Retentie</th>
              <th className="px-4 py-3 text-right">No-show</th>
              <th className="px-4 py-3 text-right">Piekmoment</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.locationId} className="border-b border-border/60 last:border-0">
                <td className="px-4 py-3 font-medium text-neutral-900">
                  {r.name}
                  {r.isDefault ? (
                    <span className="ml-2 rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                      Hoofd
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{r.activeMembers}</td>
                <td className="px-4 py-3 text-right tabular-nums">{r.visits}</td>
                <td className="px-4 py-3 text-right tabular-nums">{pct(r.retention)}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {pct(r.noShowRate)}
                  {r.noShow > 0 ? (
                    <span className="ml-1 text-xs text-neutral-400">({r.noShow})</span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-right text-xs text-neutral-600">
                  {r.peak ? `${WEEKDAYS[r.peak.weekday]} ${String(r.peak.hour).padStart(2, "0")}:00` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-neutral-400">
        Laatste {data.windowDays} dagen · retentie = aandeel van vorige maand dat deze
        maand terugkwam · tijden in de tijdzone van de vestiging.
      </p>
      <NonAdditiveNote />
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface-1 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900">{value}</p>
    </div>
  );
}
