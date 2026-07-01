// Herstelherinneringen — korte, motiverende herstelboodschappen die na een
// afgeronde training verschijnen. Willekeurig (deterministisch per training via
// seed) zodat de ervaring afwisselend blijft. Pure code, geen opslag.
//
// Bewust GEEN `server-only` (client-afrondscherm). Nieuwe tip = één string erbij.

import { pickBySeed } from "@/lib/seed-pick";

export const RECOVERY_TIPS: readonly string[] = [
  "Vergeet vandaag voldoende water te drinken.",
  "Neem voldoende rust voor optimaal herstel.",
  "Vergeet niet te stretchen.",
  "Goed gewerkt — herstel is net zo belangrijk als trainen.",
  "Een goede nachtrust maakt je training van vandaag pas af.",
  "Vul je eiwitten aan om je spieren te laten herstellen.",
  "Luister naar je lichaam en gun jezelf een rustdag als het nodig is.",
];

/** Kies deterministisch één herstelboodschap (seed = bv. sessionId). */
export function pickRecoveryTip(seed: string): string {
  return pickBySeed(RECOVERY_TIPS, seed) ?? RECOVERY_TIPS[0];
}
