import { applyMasterSuggestion } from "@/app/owner/schemas/actions";
import type { MasterSuggestion } from "@/lib/coach-insights";

/**
 * Slimme suggesties op de master-templatepagina: wanneer meerdere leden dezelfde
 * aanpassing maakten, stel voor die in de master door te voeren (server-component,
 * form → applyMasterSuggestion). Daarna kan de coach de leden re-synchroniseren.
 */
export function SchemaSuggestions({
  masterId,
  suggestions,
}: {
  masterId: string;
  suggestions: MasterSuggestion[];
}) {
  if (suggestions.length === 0) return null;

  return (
    <section className="flex max-w-3xl flex-col gap-3 rounded-2xl border border-accent/40 bg-accent-soft p-5">
      <div>
        <h2 className="text-sm font-semibold text-neutral-900">Slimme suggesties</h2>
        <p className="text-sm text-neutral-600">
          Meerdere leden maakten dezelfde aanpassing. Wil je die ook in de master
          toepassen?
        </p>
      </div>
      <ul className="flex flex-col gap-2">
        {suggestions.map((s) => (
          <li
            key={s.id}
            className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface-1 px-3 py-2"
          >
            <span className="flex-1 text-sm text-neutral-700">
              {s.text}{" "}
              <span className="text-neutral-400">
                ({s.count} van {s.total})
              </span>
            </span>
            <form action={applyMasterSuggestion}>
              <input type="hidden" name="masterId" value={masterId} />
              <input type="hidden" name="suggestionId" value={s.id} />
              <button
                type="submit"
                className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground hover:opacity-90"
              >
                Toepassen in master
              </button>
            </form>
          </li>
        ))}
      </ul>
    </section>
  );
}
