// Pure veiligheids-guardrail (geen server-only / SDK), zodat dit los testbaar is.

// Als het AI-antwoord een van deze woorden bevat, vervangen we het volledig
// door de standaard doorverwijzing (verplicht volgens prompt 11 van de gids).
export const FORBIDDEN_WORDS = [
  "diagnose",
  "medisch advies",
  "geneesmiddel",
  "blessure",
];

export const SAFETY_FALLBACK =
  "Hier kan ik je niet mee helpen — raadpleeg hiervoor een professional " +
  "(je trainer, fysiotherapeut of arts). Bij pijn of twijfel: stop met de " +
  "oefening en vraag advies.";

/** Vervang het antwoord door de safety-melding als het verboden woorden bevat. */
export function applySafetyGuardrail(text: string): string {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();
  if (FORBIDDEN_WORDS.some((w) => lower.includes(w))) {
    return SAFETY_FALLBACK;
  }
  return trimmed || SAFETY_FALLBACK;
}
