import "server-only";
import type { Locale } from "@prisma/client";

/**
 * Gedeelde bouwstenen voor élk AI-oppervlak. Een "surface" (oppervlak) = één plek in de
 * app waar de assistent contextbewust helpt. Een nieuw oppervlak toevoegen = één bestand
 * in deze map + één regel in `registry.ts` (idioom zoals `lib/exercise-types.ts`).
 */

/** Rol van de gebruiker binnen de assistent (afgeleid van de app-rol). */
export type AiRole = "member" | "coach";

/** Genormaliseerde gebruiker die aan de surface-context wordt meegegeven. */
export type SurfaceUser = {
  id: string;
  tenantId: string;
  role: AiRole;
  locale: Locale;
};

export type SurfaceBuildArgs = {
  user: SurfaceUser;
  tenantName: string;
  /** Optioneel referentie-id (bv. exerciseId of memberId), surface-specifiek. */
  ref: string | null;
};

/**
 * Eén oppervlak. `build` verzamelt de tenant-gescopede context én stelt de
 * system-prompt samen; `null` = niet gevonden / niet toegestaan (→ nette foutmelding).
 */
export type Surface = {
  id: string;
  /** Welke rollen dit oppervlak mogen gebruiken. */
  roles: AiRole[];
  /** Voorgestelde prompts (chips) in het paneel. */
  suggestions: string[];
  build: (args: SurfaceBuildArgs) => Promise<{ system: string } | null>;
};

/** Gedeelde veiligheids-/gedragsregels die bovenaan élke system-prompt staan. */
export function baseSystemPreamble(tenantName: string): string {
  return [
    `Je bent de AI Coach & Assistent van sportschool "${tenantName}".`,
    "Kernregels — altijd, zonder uitzondering:",
    "- Geef NOOIT een medische diagnose of medisch advies. Bij pijn, blessure of medische",
    "  twijfel: verwijs de gebruiker door naar een professional (trainer, fysiotherapeut of arts).",
    "- Blijf binnen déze sportschool: verwijs alleen naar apparatuur en oefeningen die in de",
    "  context hieronder staan. Verzin niets en beloof geen resultaten.",
    "- Je WIJZIGT NOOIT zelf gegevens. Wil je een wijziging voorstellen, doe dat uitsluitend als",
    "  een 'proposal' (zie het antwoordformaat). De gebruiker bevestigt zelf met 'Toepassen'.",
    "- Antwoord in dezelfde taal als de vraag. Houd het kort, concreet en motiverend.",
  ].join("\n");
}

/** Beschrijving van een toegestane proposal-soort voor in de system-prompt. */
export type ProposalSpec = { kind: string; when: string; payload: string };

/**
 * Instrueert het model om UITSLUITEND JSON terug te geven: `{ answer, proposals }`.
 * De orchestrator parset dit defensief; geen JSON → hele tekst als `answer`, 0 proposals.
 */
export function outputContract(proposals: ProposalSpec[]): string {
  const lines = [
    "",
    "ANTWOORDFORMAAT — geef UITSLUITEND geldige JSON terug (geen codeblok, geen tekst eromheen):",
    '{ "answer": string, "proposals": Proposal[] }',
    'waarbij Proposal = { "kind": string, "title": string, "summary": string, "payload": object }.',
    '"answer" bevat je tekstuele antwoord voor de gebruiker.',
  ];
  if (proposals.length === 0) {
    lines.push('Er zijn geen toepasbare acties op dit oppervlak: gebruik altijd "proposals": [].');
  } else {
    lines.push(
      'Voeg alleen een proposal toe als die écht relevant is (anders "proposals": []). Toegestane kinds:'
    );
    for (const p of proposals) {
      lines.push(`- kind "${p.kind}": ${p.when} payload: ${p.payload}`);
    }
  }
  return lines.join("\n");
}
