// Pure kern van de lid-workout-library — géén `server-only` (idioom
// lib/exercise-library/source.ts, lib/member-schema-status.ts): ook bruikbaar in
// client-componenten en tests.
//
// De library is de verzameling schema's die de sportschool heeft **vrijgegeven**
// aan haar leden. Vrijgeven is een owner-opt-in per template
// (`WorkoutTemplate.memberVisible`, toggle op de template-pagina) — er is bewust
// géén tenant-brede vlag: één vrijgegeven schema ís de library.

import type { Prisma } from "@prisma/client";

/**
 * DÉ where-clause voor "staat in de lid-library". Query-tegenhanger van de
 * owner-toggle `memberVisible`, in het idioom van `OWN_EXERCISE_WHERE`.
 *
 * Waarom een constante en geen losse checks: deze drie voorwaarden staan zowel
 * bij het **tonen** (overzicht/detail) als bij het **overnemen**
 * (`startMemberSchema` valideert de bron opnieuw — nooit de client vertrouwen).
 * Lopen die twee uit elkaar, dan toont de app een schema dat je niet kunt
 * kopiëren (of erger: laat het kopiëren van iets dat niet is vrijgegeven).
 *
 * Let op alle drie de voorwaarden — `memberVisible` alléén is niet genoeg:
 *   - `isLibrary: false` = een persoonlijk lid-schema, geen herbruikbaar sjabloon
 *   - `kind: "DAY"`      = een losse herbruikbare trainingsdag, geen heel schema
 * Voeg `tenantId` altijd zelf toe bij de aanroep (tenant-isolatie is expliciet;
 * RLS is de backstop).
 */
export const MEMBER_LIBRARY_WHERE = {
  isLibrary: true,
  memberVisible: true,
  kind: "SCHEMA",
} as const satisfies Prisma.WorkoutTemplateWhereInput;

/** Minimale vorm om te toetsen of een template in de library hoort. */
export type MemberLibraryCandidate = {
  isLibrary: boolean;
  memberVisible: boolean;
  kind: string;
};

/**
 * Predicaat-tegenhanger van `MEMBER_LIBRARY_WHERE` — voor call-sites die een al
 * geladen template beoordelen (bv. een detailpagina die de rij al in handen
 * heeft) zonder een tweede query te doen.
 */
export function isInMemberLibrary(tpl: MemberLibraryCandidate): boolean {
  return (
    tpl.isLibrary === MEMBER_LIBRARY_WHERE.isLibrary &&
    tpl.memberVisible === MEMBER_LIBRARY_WHERE.memberVisible &&
    tpl.kind === MEMBER_LIBRARY_WHERE.kind
  );
}
