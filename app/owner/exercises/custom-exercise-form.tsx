"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { saveCustomExercise, type CustomExerciseState } from "./actions";
import { MarkdownField } from "@/components/ui/markdown-field";
import {
  EXERCISE_DIFFICULTIES,
  EXERCISE_DIFFICULTY_LABELS,
} from "@/lib/exercise-meta";
import {
  EXERCISE_TYPES,
  DEFAULT_EXERCISE_TYPE,
  exerciseTypeOptions,
} from "@/lib/exercise-types";
import { X } from "@/components/ui/icons";

export type CustomExerciseFormData = {
  id: string;
  name: string;
  exerciseType: string;
  description: string | null;
  targetMuscle: string | null;
  muscleGroups: string[];
  category: string | null;
  difficulty: string | null;
  equipment: string | null;
  tags: string[];
  executionMd: string | null;
  coachingTipsMd: string | null;
  commonMistakesMd: string | null;
  notesMd: string | null;
  imageUrls: string[];
  videoUrl: string | null;
};

const inputClass =
  "rounded-lg border border-border bg-surface-1 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-accent";

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm text-neutral-700">
      <span className="font-medium">{label}</span>
      {hint ? <span className="text-xs text-neutral-500">{hint}</span> : null}
      {children}
    </label>
  );
}

export function CustomExerciseForm({
  exercise,
  blobEnabled,
}: {
  exercise?: CustomExerciseFormData;
  blobEnabled: boolean;
}) {
  const [state, formAction, pending] = useActionState<CustomExerciseState, FormData>(
    saveCustomExercise,
    {}
  );

  // Gekozen oefeningstype — stuurt later de relevante schema-velden aan.
  const [type, setType] = useState<string>(exercise?.exerciseType ?? DEFAULT_EXERCISE_TYPE);
  // Bestaande (opgeslagen) afbeeldingen — individueel te verwijderen.
  const [keptImages, setKeptImages] = useState<string[]>(exercise?.imageUrls ?? []);
  // Nieuw gekozen bestanden — met voorvertoning en individueel te verwijderen.
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Houd object-URL-previews in sync met de gekozen bestanden.
  useEffect(() => {
    const urls = newFiles.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [newFiles]);

  // Synchroniseer de gecureerde bestandenset terug naar het <input type=file>,
  // zodat precies deze bestanden meegestuurd worden bij submit.
  useEffect(() => {
    if (!fileInputRef.current) return;
    const dt = new DataTransfer();
    for (const f of newFiles) dt.items.add(f);
    fileInputRef.current.files = dt.files;
  }, [newFiles]);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    if (picked.length > 0) setNewFiles((prev) => [...prev, ...picked]);
  }

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-6">
      {exercise ? <input type="hidden" name="id" value={exercise.id} /> : null}
      <input type="hidden" name="existingImages" value={JSON.stringify(keptImages)} />

      {/* --- Basisinformatie --- */}
      <fieldset className="flex flex-col gap-4">
        <legend className="text-sm font-semibold text-neutral-900">Basisinformatie</legend>

        <Field label="Naam *">
          <input
            name="name"
            required
            defaultValue={exercise?.name}
            className={inputClass}
            placeholder="bv. Bulgaarse split squat"
          />
        </Field>

        <Field
          label="Oefeningstype *"
          hint="Bepaalt welke velden (sets/gewicht, tijd/afstand…) in het schema verschijnen."
        >
          <select
            name="exerciseType"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className={inputClass}
          >
            {exerciseTypeOptions().map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <span className="text-xs text-neutral-500">
            {EXERCISE_TYPES[type]?.description}
          </span>
        </Field>

        <Field label="Korte omschrijving">
          <textarea
            name="description"
            rows={2}
            defaultValue={exercise?.description ?? ""}
            className={inputClass}
            placeholder="Eén of twee zinnen…"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Primaire spiergroep">
            <input
              name="targetMuscle"
              defaultValue={exercise?.targetMuscle ?? ""}
              className={inputClass}
              placeholder="bv. Quadriceps"
            />
          </Field>
          <Field label="Extra spiergroepen" hint="Gescheiden door komma's">
            <input
              name="muscleGroups"
              defaultValue={(exercise?.muscleGroups ?? []).join(", ")}
              className={inputClass}
              placeholder="Bilspieren, hamstrings"
            />
          </Field>
          <Field label="Categorie">
            <input
              name="category"
              defaultValue={exercise?.category ?? ""}
              className={inputClass}
              placeholder="bv. Kracht"
            />
          </Field>
          <Field label="Moeilijkheidsgraad">
            <select
              name="difficulty"
              defaultValue={exercise?.difficulty ?? ""}
              className={inputClass}
            >
              <option value="">— Kies —</option>
              {EXERCISE_DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {EXERCISE_DIFFICULTY_LABELS[d]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Benodigd materiaal">
            <input
              name="equipment"
              defaultValue={exercise?.equipment ?? ""}
              className={inputClass}
              placeholder="bv. Dumbbells, bankje"
            />
          </Field>
          <Field label="Tags" hint="Gescheiden door komma's">
            <input
              name="tags"
              defaultValue={(exercise?.tags ?? []).join(", ")}
              className={inputClass}
              placeholder="unilateraal, mobiliteit"
            />
          </Field>
        </div>
      </fieldset>

      {/* --- Uitvoering (rich text) --- */}
      <fieldset className="flex flex-col gap-4">
        <legend className="text-sm font-semibold text-neutral-900">Uitvoering</legend>
        <MarkdownField
          name="executionMd"
          label="Uitvoering"
          defaultValue={exercise?.executionMd ?? ""}
          rows={6}
          placeholder="1. Plaats je achterste voet op het bankje…"
        />
        <MarkdownField
          name="coachingTipsMd"
          label="Coachingtips"
          defaultValue={exercise?.coachingTipsMd ?? ""}
          rows={4}
          placeholder="- Houd je torso rechtop…"
        />
        <MarkdownField
          name="commonMistakesMd"
          label="Veelgemaakte fouten"
          defaultValue={exercise?.commonMistakesMd ?? ""}
          rows={4}
          placeholder="- Knie valt naar binnen…"
        />
        <MarkdownField
          name="notesMd"
          label="Opmerkingen"
          defaultValue={exercise?.notesMd ?? ""}
          rows={3}
          placeholder="Variaties, blessurepreventie…"
        />
      </fieldset>

      {/* --- Media --- */}
      <fieldset className="flex flex-col gap-4">
        <legend className="text-sm font-semibold text-neutral-900">Media</legend>

        <div className="flex flex-col gap-2 text-sm text-neutral-700">
          <span className="font-medium">Afbeeldingen</span>
          {keptImages.length > 0 || previews.length > 0 ? (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {keptImages.map((url) => (
                <ImageThumb
                  key={url}
                  src={url}
                  onRemove={() => setKeptImages((p) => p.filter((u) => u !== url))}
                />
              ))}
              {previews.map((url, i) => (
                <ImageThumb
                  key={url}
                  src={url}
                  badge="nieuw"
                  onRemove={() =>
                    setNewFiles((p) => p.filter((_, idx) => idx !== i))
                  }
                />
              ))}
            </div>
          ) : null}

          <input
            ref={fileInputRef}
            name="images"
            type="file"
            accept="image/*"
            multiple
            disabled={!blobEnabled}
            onChange={onPick}
            className="text-sm text-neutral-700 file:mr-3 file:rounded-md file:border-0 file:bg-neutral-100 file:px-3 file:py-2 file:text-sm"
          />
          {!blobEnabled ? (
            <span className="text-xs text-neutral-500">
              Afbeeldingen-upload vereist een geconfigureerde BLOB_READ_WRITE_TOKEN.
            </span>
          ) : (
            <span className="text-xs text-neutral-500">
              Eén of meerdere afbeeldingen. Klik op een afbeelding om te verwijderen.
            </span>
          )}
        </div>

        <Field label="Video-URL (optioneel)" hint="YouTube of Vimeo">
          <input
            name="videoUrl"
            type="url"
            defaultValue={exercise?.videoUrl ?? ""}
            className={inputClass}
            placeholder="https://youtu.be/…"
          />
        </Field>
      </fieldset>

      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Opslaan…" : "Opslaan"}
        </button>
      </div>
    </form>
  );
}

function ImageThumb({
  src,
  onRemove,
  badge,
}: {
  src: string;
  onRemove: () => void;
  badge?: string;
}) {
  return (
    <div className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-surface-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="h-full w-full object-cover" />
      {badge ? (
        <span className="absolute left-1 top-1 rounded bg-accent px-1.5 py-0.5 text-[10px] font-medium text-accent-foreground">
          {badge}
        </span>
      ) : null}
      <button
        type="button"
        onClick={onRemove}
        aria-label="Afbeelding verwijderen"
        className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
