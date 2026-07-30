import { Dumbbell } from "@/components/ui/icons";
import type { SchemaImage } from "@/lib/schema-image";

/**
 * Het beeld van één trainingsschema. Géén `"use client"`: puur presentationeel,
 * dus bruikbaar vanuit server- én client-componenten (zoals `SchemaBadges`).
 *
 * De drie bronnen uit `schemaImage` (lib/schema-image.ts) vragen om drie
 * weergaves — een uitgesneden wordmark is geen sfeerfoto:
 *   - `photo` → vult de hele kaart (`object-cover`)
 *   - `logo`  → gecentreerd en volledig zichtbaar op een rustig accent-vlak
 *   - `null`  → accent-verloop met een discreet icoon (nooit een gat in de UI)
 *
 * Bewust een rauwe `<img>` en geen `next/image`: zonder Blob-token levert de
 * upload lokaal een data-URL op, en die kan de image-optimizer niet aan.
 */
export function SchemaCover({
  image,
  className = "",
  /** 3:2 (zie SCHEMA_COVER_ASPECT) — uitgezet bij een vaste hoogte van de ouder. */
  aspect = true,
  /** Vervangt de alt-tekst van de foto, bv. met de schemanaam op een lijstitem. */
  alt,
  priority = false,
}: {
  image: SchemaImage | null;
  className?: string;
  aspect?: boolean;
  alt?: string;
  priority?: boolean;
}) {
  const base = `relative overflow-hidden bg-surface-2 ${aspect ? "aspect-[3/2]" : ""} ${className}`;

  if (!image) {
    return (
      <div className={`${base} flex items-center justify-center bg-accent-soft`} aria-hidden>
        <Dumbbell className="size-6 text-accent opacity-40" />
      </div>
    );
  }

  if (image.kind === "logo") {
    return (
      <div className={`${base} flex items-center justify-center bg-accent-soft p-4`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.url}
          alt={alt ?? ""}
          loading={priority ? "eager" : "lazy"}
          className="max-h-full max-w-full object-contain"
        />
      </div>
    );
  }

  return (
    <div className={base}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image.url}
        alt={alt ?? image.alt}
        loading={priority ? "eager" : "lazy"}
        className="size-full object-cover"
      />
    </div>
  );
}
