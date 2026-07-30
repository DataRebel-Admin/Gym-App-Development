// Thumbnail-resolutie van een tenant-oefening — puur, géén `server-only`
// (idioom lib/exercise-library/media.ts): ook bruikbaar in client-componenten
// en tests.
//
// BRON-BEWUST (3-weg), dezelfde volgorde als `exerciseSourceOf`: bibliotheek
// (RepDB-media) → klassieke catalogus → eigen upload. Sinds de bibliotheek dé
// standaardbron is levert een losse `catalog.imageUrl`-check bij de meeste
// oefeningen niets meer op — de afbeelding zit dan in `library.images`. Gebruik
// daarom altijd deze helper (vgl. `OWN_EXERCISE_WHERE`) i.p.v. de ??-keten
// opnieuw uit te schrijven, en selecteer de relaties met de constanten
// hieronder zodat een call-site de bibliotheek niet stil kan vergeten.

import { libraryImageKeys, libraryMediaUrl } from "./exercise-library/media";

/** Relaties die `exerciseThumbUrl` nodig heeft (voor `include` én `select`). */
export const EXERCISE_THUMB_RELATIONS = {
  catalog: { select: { imageUrl: true, gifUrl: true } },
  library: { select: { id: true, imageAlias: true, images: true } },
} as const;

/** Volledige `select` voor de thumbnail (relaties + het eigen-upload-veld). */
export const EXERCISE_THUMB_SELECT = {
  imageUrls: true,
  ...EXERCISE_THUMB_RELATIONS,
} as const;

/**
 * Minimale vorm die `exerciseThumbUrl` leest. Alles optioneel: een call-site die
 * (nog) niet alle bronnen selecteert blijft compileren en levert dan simpelweg
 * geen beeld op — nooit een harde fout.
 */
export type ExerciseThumbSource = {
  imageUrls?: string[] | null;
  library?: { id: string; imageAlias?: string | null; images?: unknown } | null;
  catalog?: { imageUrl?: string | null; gifUrl?: string | null } | null;
};

/** Eerste beschikbare afbeelding-URL van een oefening (of null). */
export function exerciseThumbUrl(ex: ExerciseThumbSource): string | null {
  const libraryKey = ex.library ? (libraryImageKeys(ex.library)[0] ?? null) : null;
  return (
    libraryMediaUrl(libraryKey) ??
    ex.catalog?.imageUrl ??
    ex.catalog?.gifUrl ??
    ex.imageUrls?.[0] ??
    null
  );
}
