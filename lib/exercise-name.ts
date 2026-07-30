/**
 * Nette weergavenaam voor een oefening uit de aanvullende collectie
 * (`ExerciseCatalog`, de oudere dataset).
 *
 * De dataset levert namen volledig in kleine letters ("lever calf press"), wat
 * naast de bibliotheek goedkoop oogt. Twee regels:
 *
 *  1. **Elk woord een hoofdletter** — óók na `-` en `/` ("3/4 sit-up" → "3/4
 *     Sit-Up"), maar nooit na een apostrof ("Farmer's Walk", niet "Farmer'S
 *     Walk"). Bewust géén kleine verbindingswoorden ("Full Range Of Motion"):
 *     vastgelegd door de eigenaar — álle woorden met een hoofdletter.
 *  2. **`lever` → `Machine`, alleen als eerste woord.** De dataset gebruikt het
 *     als voorvoegsel voor apparaat-oefeningen ("lever chest press"), maar
 *     "back lever" en "front lever" zijn calisthenics-houdingen — die mogen
 *     nooit "Machine" worden.
 *
 * Bewust puur (géén `server-only`, idioom `exercise-types.ts`) zodat de seed
 * (`prisma/seed.ts`), de owner-catalogus-add (`app/owner/exercises/actions.ts`)
 * en het normalisatiescript (`npm run data:names`) exact dezelfde naam
 * produceren. **Idempotent**: bestaande hoofdletters blijven staan, dus een
 * tweede toepassing verandert niets.
 */

/** Afkortingen die volledig in kapitalen horen (klein in de dataset). */
const ACRONYMS = new Set(["ez", "jm", "pov", "amrap", "rdl", "ghr", "tv"]);

/** Elk woord een hoofdletter; hoofdletters die er al staan blijven staan. */
export function titleCaseExerciseName(name: string): string {
  return name.replace(/[A-Za-z]+/g, (word, offset: number, full: string) => {
    // Apostrof-suffix ('s) hoort klein te blijven.
    const prev = offset > 0 ? full[offset - 1] : "";
    if (prev === "'" || prev === "’") return word;
    if (ACRONYMS.has(word.toLowerCase())) return word.toUpperCase();
    // Al een hoofdletter erin → met rust laten (idempotent, respecteert handwerk).
    if (/[A-Z]/.test(word)) return word;
    return word[0].toUpperCase() + word.slice(1);
  });
}

/** Formatteer een catalogusnaam naar de weergavenaam die we opslaan/tonen. */
export function formatExerciseName(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed) return trimmed;
  // Alleen het voorvoegsel: "back lever"/"front lever" blijven ongemoeid.
  return titleCaseExerciseName(trimmed.replace(/^lever\b/i, "Machine"));
}
