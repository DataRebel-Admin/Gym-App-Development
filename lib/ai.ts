/**
 * Publieke ingang van de AI Coach & Assistant. De implementatie is modulair opgesplitst
 * in `lib/ai/*`: `provider.ts` (model-aanroep), `surfaces/*` (contextbewuste oppervlakken)
 * en `assist.ts` (orchestrator: gate, rate-limit, guardrail, parse). Een nieuw oppervlak
 * toevoegen = één bestand in `lib/ai/surfaces/` + één regel in `surfaces/registry.ts`.
 */

export { aiConfigured } from "./ai/provider";
export {
  runSurfaceAssistant,
  aiRoleFor,
  type RunSurfaceInput,
} from "./ai/assist";
export { surfaceSuggestions } from "./ai/surfaces/registry";
export type { AiRole } from "./ai/surfaces/base";
export {
  isAssistantError,
  type AssistantResult,
  type AssistantAnswer,
  type AssistantProposal,
} from "./ai/types";
