"use client";

import { useActionState } from "react";
import { saveMachine, type MachineFormState } from "./actions";
import { MACHINE_TYPES, MACHINE_TYPE_LABELS } from "@/lib/machine";
import { MarkdownField } from "@/components/ui/markdown-field";

export type MachineFormData = {
  id: string;
  name: string;
  type: string;
  description: string | null;
  instructionsMd: string | null;
  videoUrl: string | null;
  imageUrl: string | null;
  location: string | null;
  serialNumber: string | null;
  purchaseDate: string | null; // yyyy-mm-dd
};

const inputClass =
  "rounded-lg border border-border bg-surface-1 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-accent";

export function MachineForm({
  machine,
  blobEnabled,
}: {
  machine?: MachineFormData;
  blobEnabled: boolean;
}) {
  const [state, formAction, pending] = useActionState<MachineFormState, FormData>(
    saveMachine,
    {}
  );

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-5">
      {machine ? <input type="hidden" name="id" value={machine.id} /> : null}

      <label className="flex flex-col gap-1 text-sm text-neutral-700">
        Naam *
        <input
          name="name"
          required
          defaultValue={machine?.name}
          className={inputClass}
          placeholder="bv. Loopband"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-neutral-700">
        Type
        <select
          name="type"
          defaultValue={machine?.type ?? "OVERIG"}
          className={inputClass}
        >
          {MACHINE_TYPES.map((t) => (
            <option key={t} value={t}>
              {MACHINE_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          Locatie
          <input
            name="location"
            defaultValue={machine?.location ?? ""}
            className={inputClass}
            placeholder="bv. Zone A / 1e verdieping"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          Serie-/inventarisnummer
          <input
            name="serialNumber"
            defaultValue={machine?.serialNumber ?? ""}
            className={inputClass}
            placeholder="bv. INV-00123"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          Aankoopdatum
          <input
            name="purchaseDate"
            type="date"
            defaultValue={machine?.purchaseDate ?? ""}
            className={inputClass}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm text-neutral-700">
        Beschrijving
        <textarea
          name="description"
          rows={2}
          defaultValue={machine?.description ?? ""}
          className={inputClass}
        />
      </label>

      <MarkdownField
        name="instructionsMd"
        label="Instructie (Markdown)"
        defaultValue={machine?.instructionsMd ?? ""}
        rows={6}
        placeholder="## Gebruik&#10;1. Stel de machine af…"
      />

      <label className="flex flex-col gap-1 text-sm text-neutral-700">
        Video-URL (optioneel)
        <input
          name="videoUrl"
          type="url"
          defaultValue={machine?.videoUrl ?? ""}
          className={inputClass}
          placeholder="https://…"
        />
      </label>

      <div className="flex flex-col gap-1 text-sm text-neutral-700">
        Foto
        <input
          name="photo"
          type="file"
          accept="image/*"
          disabled={!blobEnabled}
          className="text-sm text-neutral-700 file:mr-3 file:rounded-md file:border-0 file:bg-neutral-100 file:px-3 file:py-2 file:text-sm"
        />
        {!blobEnabled ? (
          <span className="text-xs text-neutral-500">
            Foto-upload vereist een geconfigureerde BLOB_READ_WRITE_TOKEN.
          </span>
        ) : null}
        {machine?.imageUrl ? (
          <span className="text-xs text-neutral-500">
            Huidige foto blijft behouden tenzij je een nieuwe kiest.
          </span>
        ) : null}
      </div>

      {state.error ? (
        <p className="text-sm text-red-600">{state.error}</p>
      ) : null}

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
