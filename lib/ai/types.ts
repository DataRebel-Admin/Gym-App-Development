/**
 * Gedeelde types voor de AI Coach & Assistant. Géén `server-only` — het paneel
 * (client) rendert deze proposals ook. Het contract tussen model → orchestrator →
 * UI is bewust klein en generiek zodat een nieuw oppervlak niets aan de UI wijzigt.
 */

/**
 * Een gestructureerd voorstel van de AI. De AI VOERT dit NOOIT zelf uit — het paneel
 * toont een "Toepassen"-knop die een bestaande, geaudite server-action aanroept.
 * `kind` bepaalt welke apply-action wordt aangeroepen; `payload` is de (per-kind
 * gevalideerde) input.
 */
export type AssistantProposal = {
  id: string;
  kind: string;
  title: string;
  summary: string;
  /** Knoptekst voor "Toepassen"; leeg → informatief voorstel zonder actie. */
  applyLabel: string | null;
  payload: unknown;
};

export type AssistantAnswer = {
  text: string;
  proposals: AssistantProposal[];
};

export type AssistantResult = AssistantAnswer | { error: string };

export function isAssistantError(
  result: AssistantResult
): result is { error: string } {
  return "error" in result;
}
