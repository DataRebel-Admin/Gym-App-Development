import "server-only";
import type { Surface } from "./base";
import { memberHomeSurface } from "./member-home";
import { exerciseSurface } from "./exercise";
import { memberProfileSurface } from "./member-profile";

/**
 * Registry van alle AI-oppervlakken. Bron van waarheid — een nieuw oppervlak toevoegen
 * = één import + één regel hier (naast het surface-bestand zelf). De orchestrator
 * (`lib/ai/assist.ts`) en de UI leunen hier volledig op.
 */
const SURFACE_LIST: Surface[] = [
  memberHomeSurface,
  exerciseSurface,
  memberProfileSurface,
];

export const SURFACES: Record<string, Surface> = Object.fromEntries(
  SURFACE_LIST.map((s) => [s.id, s])
);

export type SurfaceId = (typeof SURFACE_LIST)[number]["id"];

export function getSurface(id: string): Surface | null {
  return SURFACES[id] ?? null;
}

/** Voorgestelde prompts (chips) voor een oppervlak — ook client-bruikbaar via de action. */
export function surfaceSuggestions(id: string): string[] {
  return SURFACES[id]?.suggestions ?? [];
}
