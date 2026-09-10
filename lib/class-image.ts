// Afbeelding bij een lestype — puur, géén `server-only` (idioom
// lib/schema-image.ts): ook bruikbaar in client-componenten en tests.
//
// TWEE LAGEN, in deze volgorde (zie `classImage`):
//   1. `GroupClass.imageUrl`  — eigen upload door de sportschool (wint altijd)
//   2. sportschoollogo        — het vangnet
//
// Bewust géén gecureerde stockfoto-laag zoals bij de schema's: lestype-namen
// zijn vrije tekst ("Bootcamp 55+", "Zumba met Ans") en dus niet betrouwbaar
// op een vaste registry te matchen. Levert allebei niets op, dan rendert de
// UI een accent-vlak met icoon — een gat bestaat niet.

export type ClassImageKind = "photo" | "logo";

export type ClassImage = {
  url: string;
  kind: ClassImageKind;
  /** Beschrijvende alt-tekst; leeg bij een logo (dat is decoratief). */
  alt: string;
};

/**
 * Los het beeld van een lestype op. `null` = geen beeld beschikbaar; de
 * aanroeper toont dan een accent-vlak.
 *
 * `kind` bepaalt hóé je 'm toont: een foto vult het vlak (`object-cover`), een
 * logo staat gecentreerd op een rustige achtergrond (`object-contain`) — een
 * uitgesneden wordmark is geen sfeerbeeld.
 */
export function classImage(
  groupClass: { name: string; imageUrl: string | null },
  opts: { logoUrl?: string | null } = {}
): ClassImage | null {
  if (groupClass.imageUrl) {
    return { url: groupClass.imageUrl, kind: "photo", alt: groupClass.name };
  }
  if (opts.logoUrl) return { url: opts.logoUrl, kind: "logo", alt: "" };
  return null;
}
