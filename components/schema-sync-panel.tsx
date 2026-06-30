import { syncAssignment } from "@/app/owner/schemas/actions";
import { SchemaDiffView, describeEntry, ChangeBadge } from "@/components/schema-compare";
import type { SchemaDiff } from "@/lib/schema-diff";

/**
 * "Het oorspronkelijke trainingsschema is gewijzigd"-banner met volledige
 * coach-controle (server-component, forms → syncAssignment):
 *  - per master-wijziging "Overnemen" (mode=one),
 *  - "Alle synchroniseren" (mode=all, 3-weg — lid-overrides blijven),
 *  - "Negeren" (mode=dismiss),
 *  - "Handmatig vergelijken" (collapsible, master ↔ persoonlijk).
 */
export function SchemaSyncPanel({
  userId,
  assignmentId,
  masterDiff,
  fullDiff,
  names,
}: {
  userId: string;
  assignmentId: string;
  /** baseline → master: de nog niet overgenomen master-wijzigingen. */
  masterDiff: SchemaDiff;
  /** persoonlijk → master: voor het volledige vergelijkingsscherm. */
  fullDiff: SchemaDiff;
  names: Record<string, string>;
}) {
  return (
    <section className="flex max-w-3xl flex-col gap-3 rounded-2xl border border-accent/40 bg-accent-soft p-5">
      <div>
        <h3 className="text-sm font-semibold text-neutral-900">
          Het oorspronkelijke trainingsschema is gewijzigd
        </h3>
        <p className="text-sm text-neutral-600">
          De master is bijgewerkt sinds dit schema werd toegewezen. Kies wat je
          overneemt — persoonlijke aanpassingen van dit lid blijven behouden.
        </p>
      </div>

      {masterDiff.entries.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {masterDiff.entries.map((e) => (
            <li
              key={e.id}
              className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface-1 px-3 py-2"
            >
              <ChangeBadge kind={e.kind} />
              <span className="flex-1 text-sm text-neutral-700">{describeEntry(e, names)}</span>
              <form action={syncAssignment}>
                <input type="hidden" name="userId" value={userId} />
                <input type="hidden" name="assignmentId" value={assignmentId} />
                <input type="hidden" name="mode" value="one" />
                <input type="hidden" name="entryId" value={e.id} />
                <button
                  type="submit"
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  Overnemen
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-neutral-600">
          Structurele wijzigingen (dagen/notities) — neem ze in één keer over met
          &quot;Alle synchroniseren&quot;.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <form action={syncAssignment}>
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="assignmentId" value={assignmentId} />
          <input type="hidden" name="mode" value="all" />
          <button
            type="submit"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
          >
            Alle wijzigingen synchroniseren
          </button>
        </form>
        <form action={syncAssignment}>
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="assignmentId" value={assignmentId} />
          <input type="hidden" name="mode" value="dismiss" />
          <button
            type="submit"
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50"
          >
            Geen wijzigingen overnemen
          </button>
        </form>
      </div>

      <details className="rounded-xl border border-border bg-surface-1 p-3">
        <summary className="cursor-pointer text-sm font-medium text-neutral-700">
          Handmatig vergelijken (master ↔ persoonlijk)
        </summary>
        <div className="mt-3">
          <SchemaDiffView
            diff={fullDiff}
            names={names}
            emptyLabel="Persoonlijk schema en master zijn identiek."
          />
        </div>
      </details>
    </section>
  );
}
