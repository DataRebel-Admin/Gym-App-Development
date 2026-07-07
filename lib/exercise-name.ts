/**
 * Nette weergavenaam voor een catalogus-oefening.
 *
 * De externe dataset levert namen in kleine letters ("cable lat pulldown full
 * range of motion"). Deze pure helper title-cased ze — met verbindingswoorden in
 * kleine letters (behalve als eerste woord) — zodat een opgeslagen `Exercise.name`
 * er verzorgd uitziet. Bewust puur (géén `server-only`, idioom `exercise-types.ts`)
 * zodat zowel de seed (`prisma/seed.ts`) als de owner-catalogus-add
 * (`app/owner/exercises/actions.ts`) exact dezelfde naam produceren.
 *
 * Voorbeeld: "cable lat pulldown full range of motion" → "Cable Lat Pulldown Full
 * Range of Motion"; "push-up" → "Push-Up".
 */

const MINOR_WORDS = new Set([
  "a",
  "an",
  "and",
  "at",
  "for",
  "in",
  "of",
  "on",
  "or",
  "per",
  "the",
  "to",
  "vs",
  "with",
]);

function capitalizeSegment(segment: string): string {
  if (!segment) return segment;
  return segment.charAt(0).toUpperCase() + segment.slice(1);
}

/** Formatteer een (lowercase) catalogusnaam naar een nette weergavenaam. */
export function formatExerciseName(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;

  return trimmed
    .split(/\s+/)
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (index !== 0 && MINOR_WORDS.has(lower)) return lower;
      // Koppelteken-woorden krijgen per deel een hoofdletter ("push-up" → "Push-Up").
      return lower.split("-").map(capitalizeSegment).join("-");
    })
    .join(" ");
}
