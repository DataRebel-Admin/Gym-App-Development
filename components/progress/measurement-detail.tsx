import { Badge } from "@/components/ui/badge";
import {
  COMPOSITION_METRICS,
  CIRCUMFERENCE_METRICS,
  CONDITION_METRICS,
  MEASUREMENT_SOURCE_LABEL,
  POSE_LABEL,
  formatMetric,
  filterEnabledMetrics,
  type MetricKey,
} from "@/lib/measurement-meta";
import type { MeasurementRow } from "@/lib/measurements";

const DATE_FMT = new Intl.DateTimeFormat("nl-NL", {
  weekday: "short",
  day: "numeric",
  month: "long",
  year: "numeric",
});

function ValueGrid({
  row,
  group,
  enabled,
}: {
  row: MeasurementRow;
  group: "composition" | "circumference" | "condition";
  enabled: MetricKey[] | null;
}) {
  const metrics = filterEnabledMetrics(
    group === "composition"
      ? COMPOSITION_METRICS
      : group === "condition"
        ? CONDITION_METRICS
        : CIRCUMFERENCE_METRICS,
    enabled
  );
  const filled = metrics.filter((m) => row.values[m.key] != null);
  if (filled.length === 0) {
    return <p className="text-sm text-neutral-400">Geen waarden ingevuld.</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {filled.map((m) => (
        <div key={m.key} className="rounded-xl border border-border bg-surface-0 px-3 py-2">
          <p className="text-xs text-neutral-500">{m.label}</p>
          <p className="font-display text-lg font-bold tabular-nums text-neutral-900">
            {formatMetric(m.key, row.values[m.key])}
          </p>
        </div>
      ))}
    </div>
  );
}

/** Volledige weergave van één meting (gedeeld door owner- en lid-detailpagina). */
export function MeasurementDetail({
  row,
  enabled = null,
  canViewPhotos = true,
}: {
  row: MeasurementRow;
  /** Door de owner geselecteerde meetvelden (`null` = alle). */
  enabled?: MetricKey[] | null;
  /** Mag de foto's tonen (lid altijd; trainer alleen als het lid dat toestaat). */
  canViewPhotos?: boolean;
}) {
  const composition = filterEnabledMetrics(COMPOSITION_METRICS, enabled);
  const condition = filterEnabledMetrics(CONDITION_METRICS, enabled);
  const circumference = filterEnabledMetrics(CIRCUMFERENCE_METRICS, enabled);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-display text-xl font-bold capitalize text-neutral-900">
          {DATE_FMT.format(new Date(row.measuredAt))}
        </h2>
        <Badge tone="neutral">{MEASUREMENT_SOURCE_LABEL[row.source] ?? row.source}</Badge>
        {row.recordedByName ? (
          <span className="text-sm text-neutral-500">door {row.recordedByName}</span>
        ) : null}
      </div>

      {composition.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-neutral-900">Lichaamssamenstelling</h3>
          <ValueGrid row={row} group="composition" enabled={enabled} />
        </section>
      ) : null}

      {condition.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-neutral-900">Conditie</h3>
          <ValueGrid row={row} group="condition" enabled={enabled} />
        </section>
      ) : null}

      {circumference.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-neutral-900">Omtrekmetingen</h3>
          <ValueGrid row={row} group="circumference" enabled={enabled} />
        </section>
      ) : null}

      {row.photos.length > 0 && canViewPhotos ? (
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-neutral-900">Voortgangsfoto&apos;s</h3>
          <div className="grid grid-cols-3 gap-3">
            {row.photos.map((p) => (
              <figure key={p.id} className="flex flex-col gap-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.url}
                  alt={POSE_LABEL[p.pose] ?? p.pose}
                  className="aspect-[3/4] w-full rounded-xl border border-border object-cover"
                />
                <figcaption className="text-center text-xs text-neutral-500">
                  {POSE_LABEL[p.pose] ?? p.pose}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      ) : null}

      {row.notes ? (
        <section className="flex flex-col gap-1.5">
          <h3 className="text-sm font-semibold text-neutral-900">Opmerkingen trainer</h3>
          <p className="whitespace-pre-wrap rounded-xl bg-surface-2 px-4 py-3 text-sm text-neutral-700">
            {row.notes}
          </p>
        </section>
      ) : null}
    </div>
  );
}
