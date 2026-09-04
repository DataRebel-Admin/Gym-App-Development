"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import type { MachineType } from "@prisma/client";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Textarea, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Wrench, Check, AlertTriangle } from "@/components/ui/icons";
import { symptomsForMachineType, DEFECT_MAX_PHOTOS } from "@/lib/defects";
import {
  submitDefect,
  confirmDefect,
  getOpenDefectsForMachine,
  getReportableMachines,
  type DefectSubmitState,
  type OpenDefectSummary,
  type ReportableMachine,
} from "@/app/member/defects/actions";

export type DefectMachinePrefill = {
  id: string;
  name: string;
  type: MachineType;
};

const OTHER = "__other__";

/**
 * Meldformulier "Apparaatdefect melden" (aan de sportschool — niet aan de
 * developers, dat is ReportProblemModal). Mobile-first: met een voorgevuld
 * apparaat (QR-scan/apparaatpagina) is een melding in drie taps verstuurd —
 * symptoom kiezen → versturen; toelichting/foto's zijn optioneel.
 *
 * Duplicaatcheck: bestaat er al een open melding voor hetzelfde apparaat met
 * hetzelfde symptoom, dan tonen we die met "Ik zie dit ook" (bevestiging i.p.v.
 * nieuwe melding).
 */
export function ReportDefectModal({
  open,
  onClose,
  machine,
}: {
  open: boolean;
  onClose: () => void;
  /** Voorgevuld apparaat (QR-scan / apparaatpagina); null = zelf kiezen. */
  machine?: DefectMachinePrefill | null;
}) {
  const t = useTranslations("defects");
  const [pendingLookup, startLookup] = useTransition();

  // --- Apparaatkeuze (alleen zonder prefill) ---
  const [machines, setMachines] = useState<ReportableMachine[] | null>(null);
  const [machineChoice, setMachineChoice] = useState<string>(machine?.id ?? "");
  const [machineLabel, setMachineLabel] = useState("");

  // --- Formulierstate ---
  const [symptom, setSymptom] = useState<string | null>(null);
  const [unsafe, setUnsafe] = useState(false);
  const [anonymous, setAnonymous] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Duplicaten + bevestiging ---
  /**
   * Opgehaalde open meldingen **mét het apparaat waar ze bij horen**. Bewust
   * gekoppeld opgeslagen in plaats van een kale lijst die een effect leegmaakt:
   * dat leegmaken gebeurde synchroon in de effect-body (extra renderronde), en
   * bij snel wisselen van apparaat kon een traag antwoord voor apparaat A
   * alsnog binnenvallen terwijl B geselecteerd was. Nu leiden we de getoonde
   * lijst af, dus een antwoord dat niet bij de huidige keuze hoort telt niet.
   */
  const [dupeCache, setDupeCache] = useState<{
    machineId: string;
    rows: OpenDefectSummary[];
  } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [confirmPending, startConfirm] = useTransition();
  const [showFormAnyway, setShowFormAnyway] = useState(false);

  const [state, formAction, submitting] = useActionState<DefectSubmitState, FormData>(
    submitDefect,
    {}
  );

  const selectedMachine: { id: string; name: string; type: MachineType | null } | null =
    machine
      ? { id: machine.id, name: machine.name, type: machine.type }
      : machineChoice && machineChoice !== OTHER
        ? (() => {
            const m = machines?.find((x) => x.id === machineChoice);
            return m ? { id: m.id, name: m.name, type: m.type as MachineType } : null;
          })()
        : null;

  // Apparaten laden voor de picker (alleen zonder prefill, lazy bij openen).
  useEffect(() => {
    if (!open || machine || machines) return;
    startLookup(async () => {
      try {
        setMachines(await getReportableMachines());
      } catch {
        setMachines([]);
      }
    });
  }, [open, machine, machines]);

  // Getoonde duplicaten: alleen als het opgehaalde resultaat bij de huidige
  // keuze hoort. Afgeleid, niet in state — zie de toelichting bij `dupeCache`.
  const duplicates: OpenDefectSummary[] =
    open && selectedMachine && dupeCache?.machineId === selectedMachine.id
      ? dupeCache.rows
      : [];

  // Open meldingen van het gekozen apparaat ophalen (duplicaatcheck).
  useEffect(() => {
    if (!open || !selectedMachine) return;
    const id = selectedMachine.id;
    startLookup(async () => {
      try {
        setDupeCache({ machineId: id, rows: await getOpenDefectsForMachine(id) });
      } catch {
        setDupeCache({ machineId: id, rows: [] });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedMachine?.id]);

  // Preview-object-URLs netjes opruimen.
  useEffect(() => {
    return () => photoPreviews.forEach((p) => URL.revokeObjectURL(p));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function reset() {
    setSymptom(null);
    setUnsafe(false);
    setAnonymous(false);
    setPhotos([]);
    setPhotoPreviews((old) => {
      old.forEach((p) => URL.revokeObjectURL(p));
      return [];
    });
    setMachineChoice(machine?.id ?? "");
    setMachineLabel("");
    setConfirmed(false);
    setShowFormAnyway(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function close() {
    reset();
    onClose();
  }

  function onPickPhotos(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).slice(0, DEFECT_MAX_PHOTOS);
    setPhotos(files);
    setPhotoPreviews((old) => {
      old.forEach((p) => URL.revokeObjectURL(p));
      return files.map((f) => URL.createObjectURL(f));
    });
  }

  function removePhoto(index: number) {
    setPhotos((old) => old.filter((_, i) => i !== index));
    setPhotoPreviews((old) => {
      URL.revokeObjectURL(old[index]);
      return old.filter((_, i) => i !== index);
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const symptoms = symptomsForMachineType(selectedMachine?.type ?? null);
  const duplicate = symptom
    ? duplicates.find((d) => d.symptom === symptom) ?? null
    : null;
  const showDuplicateCard = Boolean(duplicate) && !showFormAnyway && !confirmed;

  function doConfirm() {
    if (!duplicate) return;
    startConfirm(async () => {
      const res = await confirmDefect(duplicate.id);
      if (res.ok) setConfirmed(true);
    });
  }

  // Succes-weergave: korte bevestiging, géén ticketnummer.
  if (state.ok || confirmed) {
    return (
      <Modal open={open} onClose={close} title={t("title")} className="max-w-lg">
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-accent-gradient text-accent-foreground">
            <Check size={22} />
          </span>
          <p className="text-sm text-neutral-700">
            {confirmed ? t("success.confirmed") : t("success.reported")}
          </p>
          <Button type="button" onClick={close}>
            {t("close")}
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={close} title={t("title")} className="max-w-lg">
      <form
        action={(formData) => {
          // Gecontroleerde waarden + foto's expliciet meesturen.
          formData.set("machineId", selectedMachine?.id ?? "");
          formData.set(
            "machineLabel",
            selectedMachine ? "" : machineLabel.trim()
          );
          formData.set("symptom", symptom ?? "");
          formData.set("unsafe", unsafe ? "1" : "0");
          formData.set("anonymous", anonymous ? "1" : "0");
          formData.delete("photos");
          photos.forEach((p) => formData.append("photos", p));
          formAction(formData);
        }}
        className="flex flex-col gap-4"
      >
        <p className="text-sm text-neutral-600">{t("intro")}</p>

        {/* Apparaat: voorgevuld of kiezen */}
        {machine ? (
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface-1 px-4 py-3">
            <span className="flex size-9 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <Wrench size={18} />
            </span>
            <p className="font-medium text-neutral-900">{machine.name}</p>
          </div>
        ) : (
          <Field label={t("form.machine")} required>
            <Select
              value={machineChoice}
              onChange={(e) => {
                setMachineChoice(e.target.value);
                setSymptom(null);
                setShowFormAnyway(false);
              }}
            >
              <option value="" disabled>
                {pendingLookup && !machines ? t("form.machineLoading") : t("form.machinePick")}
              </option>
              {(machines ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {m.locationName ? ` · ${m.locationName}` : ""}
                </option>
              ))}
              <option value={OTHER}>{t("form.machineOther")}</option>
            </Select>
          </Field>
        )}
        {!machine && machineChoice === OTHER ? (
          <Field label={t("form.machineOtherLabel")} required>
            <Input
              value={machineLabel}
              onChange={(e) => setMachineLabel(e.target.value)}
              required
              minLength={2}
              maxLength={120}
              placeholder={t("form.machineOtherPlaceholder")}
            />
          </Field>
        ) : null}

        {/* Symptoom: vaste keuzelijst, gefilterd op apparaattype */}
        {(selectedMachine || machineChoice === OTHER) && (
          <Field label={t("form.symptom")} required>
            <div className="flex flex-wrap gap-2">
              {symptoms.map((s) => {
                const active = symptom === s.key;
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => {
                      setSymptom(s.key);
                      setShowFormAnyway(false);
                    }}
                    className={`rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                      active
                        ? "border-accent bg-accent-soft text-accent"
                        : "border-border bg-surface-1 text-neutral-700 hover:bg-surface-2"
                    }`}
                  >
                    {t(`symptoms.${s.key}`)}
                  </button>
                );
              })}
            </div>
          </Field>
        )}

        {/* Duplicaat: al gemeld → "ik zie dit ook" i.p.v. nieuwe melding */}
        {showDuplicateCard && duplicate ? (
          <div className="rounded-2xl border-2 border-accent bg-accent-soft px-4 py-4">
            <p className="font-semibold text-neutral-900">{t("duplicate.title")}</p>
            <p className="mt-1 text-sm text-neutral-600">
              {t("duplicate.body", { count: duplicate.confirmations })}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {duplicate.mine ? (
                <p className="text-sm font-medium text-neutral-700">{t("duplicate.mine")}</p>
              ) : (
                <Button type="button" onClick={doConfirm} loading={confirmPending}>
                  {t("duplicate.confirm")}
                </Button>
              )}
              <Button type="button" variant="ghost" onClick={() => setShowFormAnyway(true)}>
                {t("duplicate.reportAnyway")}
              </Button>
            </div>
          </div>
        ) : null}

        {symptom && !showDuplicateCard ? (
          <>
            <Field label={t("form.description")} hint={t("form.descriptionHint")}>
              <Textarea
                name="description"
                maxLength={2000}
                rows={3}
                placeholder={t("form.descriptionPlaceholder")}
              />
            </Field>

            {/* Foto's: optioneel, max 2, mét AVG-waarschuwing */}
            <Field label={t("form.photos")} hint={t("form.photosHint")}>
              {photoPreviews.length > 0 ? (
                <div className="flex flex-wrap items-start gap-3">
                  {photoPreviews.map((src, i) => (
                    <div key={src} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={src}
                        alt=""
                        className="h-24 w-24 rounded-xl border border-border object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removePhoto(i)}
                        aria-label={t("form.photoRemove")}
                        className="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full bg-neutral-900 text-xs text-white"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
              {photos.length < DEFECT_MAX_PHOTOS ? (
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={onPickPhotos}
                  className="mt-2 text-sm text-neutral-600 file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-neutral-700"
                />
              ) : null}
            </Field>

            {/* Veiligheidsvraag → UNSAFE */}
            <Field label={t("form.safety")} required>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setUnsafe(false)}
                  className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                    !unsafe
                      ? "border-accent bg-accent-soft text-accent"
                      : "border-border bg-surface-1 text-neutral-700"
                  }`}
                >
                  {t("form.safetyYes")}
                </button>
                <button
                  type="button"
                  onClick={() => setUnsafe(true)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                    unsafe
                      ? "border-red-500 bg-red-50 text-red-700"
                      : "border-border bg-surface-1 text-neutral-700"
                  }`}
                >
                  <AlertTriangle size={15} /> {t("form.safetyNo")}
                </button>
              </div>
            </Field>
            {unsafe ? (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {t("form.unsafeNote")}
              </p>
            ) : null}

            <label className="flex items-center gap-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={anonymous}
                onChange={(e) => setAnonymous(e.target.checked)}
                className="size-4 rounded accent-[var(--tenant-accent,#ff4d00)]"
              />
              {t("form.anonymous")}
            </label>
          </>
        ) : null}

        {state.rateLimited ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {t("errors.rateLimited")}
          </p>
        ) : state.error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {t("errors.generic")}
          </p>
        ) : null}

        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="ghost" onClick={close} disabled={submitting}>
            {t("cancel")}
          </Button>
          <Button
            type="submit"
            loading={submitting}
            disabled={!symptom || showDuplicateCard || (!selectedMachine && machineLabel.trim().length < 2)}
          >
            {t("submit")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** Zelfstandige trigger + modal (QR-pagina, /member/defects). */
export function ReportDefectButton({
  machine,
  variant = "outline",
  className,
}: {
  machine?: DefectMachinePrefill | null;
  variant?: "outline" | "primary";
  className?: string;
}) {
  const t = useTranslations("defects");
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          (variant === "primary"
            ? "inline-flex items-center justify-center gap-2 rounded-2xl bg-accent-gradient px-5 py-3 font-semibold text-accent-foreground focus-ring"
            : "flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-surface-1 px-5 py-3 text-sm font-semibold text-neutral-700 active:bg-surface-2")
        }
      >
        <Wrench size={17} /> {t("button")}
      </button>
      <ReportDefectModal open={open} onClose={() => setOpen(false)} machine={machine} />
    </>
  );
}
