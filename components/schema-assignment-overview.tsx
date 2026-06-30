import { Badge } from "@/components/ui/badge";
import type { AssignmentRow } from "@/lib/schema-assignments";
import { ASSIGNMENT_STATUS_META, fmtDate, fmtDateTime } from "@/lib/schema-status";

/**
 * Overzicht per schema (owner): aan welke leden toegewezen, publicatiestatus,
 * publicatiedatum, ingangs-/einddatum, laatst gewijzigd en het aantal actieve
 * toewijzingen. Puur presentationeel (server-renderbaar).
 */
export function SchemaAssignmentOverview({ rows }: { rows: AssignmentRow[] }) {
  const active = rows.filter((r) => r.active).length;
  const scheduled = rows.filter((r) => r.status === "SCHEDULED").length;
  const drafts = rows.filter((r) => r.status === "DRAFT").length;

  if (rows.length === 0) {
    return (
      <p className="text-sm text-neutral-500">
        Dit schema is nog niet toegewezen. Gebruik het paneel hierboven.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2 text-xs">
        <Badge tone="success">{active} actief</Badge>
        {scheduled > 0 ? <Badge tone="warning">{scheduled} gepland</Badge> : null}
        {drafts > 0 ? <Badge tone="neutral">{drafts} concept</Badge> : null}
        <Badge tone="neutral">{rows.length} totaal</Badge>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-2 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-3 py-2 font-medium">Lid</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Beschikbaar / gepubliceerd</th>
              <th className="px-3 py-2 font-medium">Periode</th>
              <th className="px-3 py-2 font-medium">Gewijzigd</th>
              <th className="px-3 py-2 font-medium">Gezien</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const meta = ASSIGNMENT_STATUS_META[r.status];
              return (
                <tr key={r.id} className="border-t border-neutral-100">
                  <td className="px-3 py-2 font-medium text-neutral-900">{r.memberName}</td>
                  <td className="px-3 py-2">
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                  </td>
                  <td className="px-3 py-2 text-neutral-600">
                    {r.status === "SCHEDULED"
                      ? fmtDateTime(r.availableFrom)
                      : fmtDate(r.publishedAt)}
                  </td>
                  <td className="px-3 py-2 text-neutral-600">
                    {fmtDate(r.startDate)}
                    {r.endDate ? ` – ${fmtDate(r.endDate)}` : ""}
                  </td>
                  <td className="px-3 py-2 text-neutral-600">{fmtDate(r.updatedAt)}</td>
                  <td className="px-3 py-2 text-neutral-600">
                    {r.status === "PUBLISHED"
                      ? r.seenAt
                        ? "✓"
                        : <span className="text-accent">Nieuw</span>
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
