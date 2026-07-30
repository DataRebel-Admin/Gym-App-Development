// Media-paden van de oefeningen-bibliotheek (RepDB) — puur, géén `server-only`
// (idioom lib/exercise-types.ts): ook bruikbaar in client-componenten en tests.
//
// De bibliotheek bewaart RELATIEVE blob-keys ("images/classic/bench-press-start.webp");
// de basis-URL komt uit env. Een containerwissel is daarmee config, geen
// datamigratie (les van de exercise-media → exercise-media-legacy-hernoeming).
//
// Bestandsconventie (RepDB-README):
//   images/<stijl>/<slug>-<variant>.webp   stijl: classic|flat, variant: start|peak|main
//   images/animations/<slug>.webp          alleen bij animation=true
//   images/muscles/<bestand>               uit LibraryMuscle.image
//   images/equipment/<bestand>             uit LibraryEquipment.image
// Bij `imageAlias` gelden de bestanden van de alias-slug (bv. "paused-ohp" → "ohp").

export type LibraryImageStyle = "classic" | "flat";
export type LibraryImageVariant = "start" | "peak" | "main";

/** Standaard-beeldstijl in de app: classic (transparant → composeert op elke
 *  tenant-huisstijl). `flat` blijft beschikbaar als alternatief. */
export const DEFAULT_LIBRARY_STYLE: LibraryImageStyle = "classic";

/** Basis-URL van de publieke media-container (zonder slash aan het einde). */
export function libraryMediaBaseUrl(): string {
  const v = process.env.LIBRARY_MEDIA_BASE_URL;
  return (v && v.trim() !== "" ? v : "https://datarebel.blob.core.windows.net/exercise-media").replace(/\/+$/, "");
}

type ImageCarrier = {
  id: string;
  imageAlias?: string | null;
  /** {"classic": ["start","peak"], "flat": ["main"]} — uit LibraryExercise.images. */
  images?: unknown;
  animation?: boolean;
};

/** Slug waarop de bestandsnamen gebaseerd zijn (alias wint van id). */
export function libraryImageSlug(ex: Pick<ImageCarrier, "id" | "imageAlias">): string {
  return ex.imageAlias?.trim() || ex.id;
}

/** Parse het `images`-Json defensief naar {stijl: varianten[]}. */
export function parseImageVariants(images: unknown): Partial<Record<LibraryImageStyle, LibraryImageVariant[]>> {
  if (!images || typeof images !== "object" || Array.isArray(images)) return {};
  const out: Partial<Record<LibraryImageStyle, LibraryImageVariant[]>> = {};
  for (const style of ["classic", "flat"] as const) {
    const v = (images as Record<string, unknown>)[style];
    if (!Array.isArray(v)) continue;
    const variants = v.filter(
      (x): x is LibraryImageVariant => x === "start" || x === "peak" || x === "main"
    );
    if (variants.length > 0) out[style] = variants;
  }
  return out;
}

/** Relatieve key van één beeldvariant. */
export function libraryImageKey(
  ex: Pick<ImageCarrier, "id" | "imageAlias">,
  style: LibraryImageStyle,
  variant: LibraryImageVariant
): string {
  return `images/${style}/${libraryImageSlug(ex)}-${variant}.webp`;
}

/**
 * Keys van de beelden in weergavevolgorde (start → peak, of alleen main) voor
 * een stijl — met terugval op de andere stijl als de gevraagde ontbreekt.
 */
export function libraryImageKeys(ex: ImageCarrier, style: LibraryImageStyle = DEFAULT_LIBRARY_STYLE): string[] {
  const variants = parseImageVariants(ex.images);
  const chosen = variants[style] ?? variants[style === "classic" ? "flat" : "classic"];
  const usedStyle = variants[style] ? style : (variants[style === "classic" ? "flat" : "classic"] ? (style === "classic" ? "flat" : "classic") : null);
  if (!chosen || !usedStyle) return [];
  const order: LibraryImageVariant[] = ["start", "peak", "main"];
  return order
    .filter((v) => chosen.includes(v))
    .map((v) => libraryImageKey(ex, usedStyle, v));
}

/** Relatieve key van de animatie (of null als de oefening er geen heeft). */
export function libraryAnimationKey(ex: ImageCarrier): string | null {
  if (!ex.animation) return null;
  return `images/animations/${libraryImageSlug(ex)}.webp`;
}

/** Relatieve key van een spierdiagram (LibraryMuscle.image). */
export function muscleImageKey(image: string | null | undefined): string | null {
  return image ? `images/muscles/${image}` : null;
}

/** Relatieve key van een materiaal-icoon (LibraryEquipment.image). */
export function equipmentImageKey(image: string | null | undefined): string | null {
  return image ? `images/equipment/${image}` : null;
}

/** Relatieve key → absolute URL. Null blijft null (handig bij optionele media). */
export function libraryMediaUrl(key: string | null | undefined): string | null {
  if (!key) return null;
  return `${libraryMediaBaseUrl()}/${key}`;
}
