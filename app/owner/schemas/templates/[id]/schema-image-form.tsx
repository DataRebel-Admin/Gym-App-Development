"use client";

import { useActionState, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { SchemaCover } from "@/components/schema/schema-cover";
import type { SchemaImage } from "@/lib/schema-image";
import { setTemplateImage, type SchemaImageState } from "../../actions";

/**
 * Eigen omslagfoto van een schema instellen of verwijderen. Toont altijd het
 * beeld dat het schema nú krijgt — dus ook de geërfde voorbeeldschema-foto of
 * het sportschoollogo — zodat zichtbaar is waaróp de eigen foto een verbetering
 * zou zijn. Verwijderen valt terug op datzelfde vangnet: leeg kan niet.
 */
export function SchemaImageForm({
  templateId,
  image,
  hasOwnImage,
  source,
}: {
  templateId: string;
  image: SchemaImage | null;
  /** Heeft dit schema een eigen upload? (bepaalt of "Verwijderen" zin heeft) */
  hasOwnImage: boolean;
  /** Waar het huidige beeld vandaan komt — uitleg onder de voorvertoning. */
  source: "own" | "library" | "logo" | "none";
}) {
  const [state, formAction, pending] = useActionState<SchemaImageState, FormData>(
    setTemplateImage,
    {}
  );
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const shown: SchemaImage | null = preview
    ? { url: preview, kind: "photo", alt: "" }
    : image;

  const explanation = {
    own: "Eigen afbeelding van je sportschool.",
    library: "Overgenomen van het voorbeeldschema uit de bibliotheek.",
    logo: "Standaard: je sportschoollogo. Upload een foto voor een eigen sfeer.",
    none: "Nog geen afbeelding. Stel een logo in bij je huisstijl, of upload hier een foto.",
  }[source];

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <div className="w-full shrink-0 sm:w-56">
        <SchemaCover image={shown} className="rounded-xl border border-border" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <p className="text-sm text-neutral-500">{explanation}</p>

        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="id" value={templateId} />
          <input
            ref={fileRef}
            type="file"
            name="image"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              setPreview(file ? URL.createObjectURL(file) : null);
            }}
            className="block w-full text-sm text-neutral-600 file:mr-3 file:rounded-lg file:border file:border-border-strong file:bg-surface-1 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-neutral-900 hover:file:bg-neutral-50"
          />
          <p className="text-xs text-neutral-400">
            JPG, PNG of WebP, maximaal 5 MB. Liggend beeld (3:2) staat het mooist.
          </p>
          {state.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" loading={pending} size="sm">
              Afbeelding opslaan
            </Button>
            {state.ok ? <span className="text-sm text-green-700">Opgeslagen ✓</span> : null}
          </div>
        </form>

        {hasOwnImage ? (
          <form
            action={formAction}
            onSubmit={() => {
              setPreview(null);
              if (fileRef.current) fileRef.current.value = "";
            }}
          >
            <input type="hidden" name="id" value={templateId} />
            <input type="hidden" name="remove" value="true" />
            <button
              type="submit"
              className="text-sm text-neutral-500 underline-offset-2 hover:text-neutral-900 hover:underline"
            >
              Eigen afbeelding verwijderen
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
