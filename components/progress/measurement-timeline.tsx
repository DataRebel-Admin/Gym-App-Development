import Link from "next/link";
import {
  PRIMARY_METRICS,
  MEASUREMENT_SOURCE_LABEL,
  formatMetric,
  isMetricEnabled,
  type MetricKey,
} from "@/lib/measurement-meta";
import type { MeasurementRow } from "@/lib/measurements";

const DATE_FMT = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "long", year: "numeric" });

function Row({ row, href, enabled }: { row: MeasurementRow; href?: string; enabled: MetricKey[] | null }) {
  const key = PRIMARY_METRICS.filter(
    (m) => row.values[m.key] != null && isMetricEnabled(m.key, enabled)
  ).slice(0, 4);
  const inner = (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-surface-1 p-4 shadow-sm transition-colors hover:bg-neutral-50">
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <span className="min-w-0 break-words font-semibold capitalize text-neutral-900">
          {DATE_FMT.format(new Date(row.measuredAt))}
        </span>
        <span className="text-xs text-neutral-400">
          {MEASUREMENT_SOURCE_LABEL[row.source] ?? row.source}
          {row.recordedByName ? ` · ${row.recordedByName}` : ""}
        </span>
      </div>
      {key.length > 0 ? (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {key.map((m) => (
            <span key={m.key} className="text-neutral-600">
              {m.label}:{" "}
              <strong className="tabular-nums text-neutral-900">
                {formatMetric(m.key, row.values[m.key])}
              </strong>
            </span>
          ))}
        </div>
      ) : null}
      {row.notes ? <p className="line-clamp-1 text-xs text-neutral-500">{row.notes}</p> : null}
    </div>
  );
  return href ? (
    <Link href={href} className="block">
      {inner}
    </Link>
  ) : (
    inner
  );
}

/** Tijdlijn van metingen (nieuwste eerst). `hrefBase` → elke regel linkt naar detail. */
export function MeasurementTimeline({
  rows,
  hrefBase,
  enabled = null,
}: {
  rows: MeasurementRow[];
  hrefBase?: string;
  /** Door de owner geselecteerde meetvelden (`null` = alle). */
  enabled?: MetricKey[] | null;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border bg-surface-0 px-4 py-8 text-center text-sm text-neutral-500">
        Nog geen metingen vastgelegd.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {rows.map((row) => (
        <Row
          key={row.id}
          row={row}
          href={hrefBase ? `${hrefBase}/${row.id}` : undefined}
          enabled={enabled}
        />
      ))}
    </div>
  );
}
