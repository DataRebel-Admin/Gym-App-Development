import { Badge, type BadgeTone } from "@/components/ui/badge";
import type { SchemaDiff, DiffEntry, ItemField, ItemSnapshot } from "@/lib/schema-diff";

/**
 * Presentatie van een schema-diff (server-renderbaar). Hergebruikt voor:
 * - de "Aangepast"-samenvatting per lid (diff baseline → persoonlijke kopie),
 * - het vergelijkingsscherm master ↔ persoonlijk,
 * - de lijst master-wijzigingen in de sync-flow.
 *
 * Oefening-namen worden via een `names`-map (exerciseId → naam) opgelost zodat
 * de diff-engine puur en dependency-vrij blijft.
 */

const FIELD_LABEL: Record<ItemField, string> = {
  sets: "sets",
  reps: "reps",
  weightKg: "gewicht",
  restSeconds: "rust",
  tempo: "tempo",
  params: "doelwaarden",
  notes: "notitie",
};

function fmtVal(f: ItemField, v: ItemSnapshot[ItemField]): string {
  if (v === null || v === undefined || v === "") return "—";
  if (f === "weightKg") return `${v} kg`;
  if (f === "restSeconds") return `${v}s`;
  return String(v);
}

const KIND_TONE: Record<DiffEntry["kind"], BadgeTone> = {
  changed: "accent",
  added: "success",
  removed: "danger",
  replaced: "warning",
};
const KIND_LABEL: Record<DiffEntry["kind"], string> = {
  changed: "Gewijzigd",
  added: "Toegevoegd",
  removed: "Verwijderd",
  replaced: "Vervangen",
};

function exName(names: Record<string, string>, id: string): string {
  return names[id] ?? "Oefening";
}

/** Korte, leesbare omschrijving van één diff-entry. */
export function describeEntry(e: DiffEntry, names: Record<string, string>): string {
  switch (e.kind) {
    case "changed": {
      const parts = (e.fields ?? []).map((f) =>
        f === "params"
          ? "doelwaarden bijgewerkt"
          : `${FIELD_LABEL[f]} ${fmtVal(f, e.before?.[f] ?? null)} → ${fmtVal(f, e.after?.[f] ?? null)}`
      );
      return `${exName(names, e.exerciseId)}: ${parts.join(", ")}`;
    }
    case "replaced":
      return `${exName(names, e.fromExerciseId ?? "")} → ${exName(names, e.exerciseId)}`;
    case "added":
      return `${exName(names, e.exerciseId)} (${e.after?.sets ?? "?"}×${e.after?.reps ?? "?"})`;
    case "removed":
      return exName(names, e.exerciseId);
  }
}

export function ChangeBadge({ kind }: { kind: DiffEntry["kind"] }) {
  return <Badge tone={KIND_TONE[kind]}>{KIND_LABEL[kind]}</Badge>;
}

/** Lijst van diff-entries, gegroepeerd per dag, met kleur/badge per categorie. */
export function SchemaDiffView({
  diff,
  names,
  emptyLabel = "Geen verschillen.",
}: {
  diff: SchemaDiff;
  names: Record<string, string>;
  emptyLabel?: string;
}) {
  const daysWithChanges = diff.days.filter(
    (d) => d.entries.length > 0 || d.status !== "present" || d.notesChanged
  );
  if (daysWithChanges.length === 0 && !diff.coachNoteChanged) {
    return <p className="text-sm text-neutral-500">{emptyLabel}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {diff.coachNoteChanged ? (
        <p className="text-sm text-neutral-600">
          <Badge tone="accent">Coach-notitie</Badge> <span className="ml-1">gewijzigd</span>
        </p>
      ) : null}
      {daysWithChanges.map((d) => (
        <div key={d.dayIndex} className="rounded-xl border border-border p-3">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-sm font-semibold text-neutral-900">{d.name}</span>
            {d.status === "added" ? <Badge tone="success">Nieuwe dag</Badge> : null}
            {d.status === "removed" ? <Badge tone="danger">Dag verwijderd</Badge> : null}
            {d.notesChanged ? <Badge tone="accent">Dag-notitie</Badge> : null}
          </div>
          {d.entries.length > 0 ? (
            <ul className="flex flex-col gap-1.5">
              {d.entries.map((e) => (
                <li key={e.id} className="flex items-start gap-2 text-sm text-neutral-700">
                  <ChangeBadge kind={e.kind} />
                  <span>{describeEntry(e, names)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}
    </div>
  );
}
