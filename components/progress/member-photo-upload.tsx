"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { Plus } from "@/components/ui/icons";
import { POSE_LABEL } from "@/lib/measurement-meta";
import { addProgressPhotos, type PhotoUploadState } from "@/app/member/progress/actions";

const POSES = ["FRONT", "SIDE", "BACK"] as const;

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function PhotoInput({ pose }: { pose: (typeof POSES)[number] }) {
  const [preview, setPreview] = useState<string | null>(null);
  return (
    <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-surface-0 p-3 text-center transition-colors hover:border-accent">
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="" className="aspect-[3/4] w-full rounded-lg object-cover" />
      ) : (
        <div className="flex aspect-[3/4] w-full items-center justify-center text-2xl text-neutral-300">
          📷
        </div>
      )}
      <span className="text-xs font-medium text-neutral-600">{POSE_LABEL[pose]}</span>
      <input
        type="file"
        name={`photo_${pose}`}
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          setPreview(file ? URL.createObjectURL(file) : null);
        }}
      />
    </label>
  );
}

/**
 * Lid uploadt zelf voortgangsfoto's (front/zij/achter). Mobile-first, met
 * camera-capture. De foto's zijn privé tenzij het lid de trainer toegang geeft
 * (accountinstellingen). Klapt in/uit zodat de pagina rustig blijft.
 */
export function MemberPhotoUpload() {
  const { success } = useToast();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<PhotoUploadState, FormData>(
    addProgressPhotos,
    {}
  );

  useEffect(() => {
    if (state.ok) {
      success("Foto's toegevoegd");
      setOpen(false);
    }
  }, [state.ok, success]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-surface-0 px-4 py-3 text-sm font-semibold text-neutral-700 transition-colors hover:border-accent hover:text-accent"
      >
        <Plus className="size-4" /> Voortgangsfoto toevoegen
      </button>
    );
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-2xl border border-border bg-surface-1 p-4 shadow-sm"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-neutral-900">Voortgangsfoto toevoegen</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs font-medium text-neutral-500 hover:text-neutral-900"
        >
          Annuleren
        </button>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-neutral-600">Datum</span>
        <input
          type="date"
          name="measuredAt"
          defaultValue={todayISO()}
          className="rounded-xl border border-border bg-surface-0 px-3 py-2.5 text-base text-neutral-900 outline-none focus:border-accent"
        />
      </label>

      <div className="grid grid-cols-3 gap-3">
        {POSES.map((pose) => (
          <PhotoInput key={pose} pose={pose} />
        ))}
      </div>

      <p className="text-xs text-neutral-500">
        Je foto&apos;s zijn privé. Je trainer ziet ze alleen als je dat aanzet bij
        Account &rsaquo; Meldingen &amp; privacy.
      </p>

      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}

      <Button type="submit" size="lg" loading={pending}>
        Foto&apos;s opslaan
      </Button>
    </form>
  );
}
