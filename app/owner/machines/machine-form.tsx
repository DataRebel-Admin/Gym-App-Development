"use client";

import { useActionState, useState } from "react";
import Markdown from "react-markdown";
import { saveMachine, type MachineFormState } from "./actions";
import { MACHINE_TYPES, MACHINE_TYPE_LABELS } from "@/lib/machine";

export type MachineFormData = {
  id: string;
  name: string;
  type: string;
  description: string | null;
  instructionsMd: string | null;
  videoUrl: string | null;
  imageUrl: string | null;
};

const inputClass =
  "rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-accent";

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
  const [instructions, setInstructions] = useState(machine?.instructionsMd ?? "");

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

      <label className="flex flex-col gap-1 text-sm text-neutral-700">
        Beschrijving
        <textarea
          name="description"
          rows={2}
          defaultValue={machine?.description ?? ""}
          className={inputClass}
        />
      </label>

      <div className="flex flex-col gap-1 text-sm text-neutral-700">
        Instructie (Markdown)
        <textarea
          name="instructionsMd"
          rows={6}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          className={`${inputClass} font-mono`}
          placeholder="## Gebruik&#10;1. Stel de machine af…"
        />
        {instructions.trim() ? (
          <div className="mt-2 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
            <p className="mb-2 text-xs uppercase tracking-wide text-neutral-500">
              Voorbeeld
            </p>
            <div className="prose prose-sm prose-neutral max-w-none [&_h2]:mt-0 [&_h2]:text-base [&_h2]:font-semibold [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5">
              <Markdown>{instructions}</Markdown>
            </div>
          </div>
        ) : null}
      </div>

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
