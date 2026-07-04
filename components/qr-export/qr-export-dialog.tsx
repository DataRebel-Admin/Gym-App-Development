"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { QrCode, FileText, Download, Check } from "@/components/ui/icons";
import {
  DEFAULT_QR_EXPORT_OPTIONS,
  LAYOUT_PRESETS,
  expectedPageCount,
  type QrExportFormat,
  type QrExportOptions,
} from "@/lib/qr-export/types";
import { postDownload } from "@/lib/qr-export/post-download";

export type PreviewMachine = {
  id: string;
  name: string;
  number: number;
  category: string;
};

type Scope = { key: string; label: string; machines: PreviewMachine[] };

const FORMATS: { value: QrExportFormat; label: string; hint: string }[] = [
  { value: "pdf", label: "PDF", hint: "Printbaar A4-raster" },
  { value: "zip-png", label: "ZIP · PNG", hint: "Losse afbeeldingen" },
  { value: "zip-svg", label: "ZIP · SVG", hint: "Losse vectoren" },
];

/**
 * Herbruikbare export-dialoog: kies bron (selectie/filter/alles), formaat en
 * opmaak, met live voorvertoning (aantal + pagina's + mock-raster) en download.
 * Stuurt de gekozen `ids` naar het route-endpoint (WYSIWYG met de UI-selectie).
 */
export function QrExportDialog({
  open,
  onClose,
  endpoint,
  hiddenParams,
  selected,
  filtered,
  all,
}: {
  open: boolean;
  onClose: () => void;
  endpoint: string;
  hiddenParams?: Record<string, string>;
  selected: PreviewMachine[];
  filtered: PreviewMachine[];
  all: PreviewMachine[];
}) {
  const scopes = useMemo<Scope[]>(() => {
    const list: Scope[] = [];
    if (selected.length > 0) {
      list.push({ key: "selected", label: `Geselecteerde apparaten`, machines: selected });
    }
    list.push({ key: "filtered", label: `Huidige filter`, machines: filtered });
    list.push({ key: "all", label: `Alle apparaten`, machines: all });
    return list;
  }, [selected, filtered, all]);

  const [scopeKey, setScopeKey] = useState<string>(scopes[0]?.key ?? "all");
  const [options, setOptions] = useState<QrExportOptions>(DEFAULT_QR_EXPORT_OPTIONS);
  const [busy, setBusy] = useState(false);

  // Als de selectie verandert terwijl de dialoog open is, val terug op geldig scope.
  const activeScope = scopes.find((s) => s.key === scopeKey) ?? scopes[0];
  const machines = activeScope?.machines ?? [];
  const count = machines.length;
  const isPdf = options.format === "pdf";
  const pages = expectedPageCount(count, options.columns);
  const preset = LAYOUT_PRESETS[options.columns];

  function set<K extends keyof QrExportOptions>(key: K, value: QrExportOptions[K]) {
    setOptions((o) => ({ ...o, [key]: value }));
  }

  function download() {
    if (count === 0) return;
    setBusy(true);
    // POST via een verborgen formulier → grote id-selecties passen in de body
    // (geen URL-lengtelimiet). Attachment-respons downloadt zonder paginanavigatie.
    postDownload(endpoint, {
      format: options.format,
      columns: String(options.columns),
      cutMarks: options.cutMarks ? "1" : "0",
      logo: options.includeLogo ? "1" : "0",
      serial: options.includeSerial ? "1" : "0",
      category: options.includeCategory ? "1" : "0",
      ids: machines.map((m) => m.id).join(","),
      ...(hiddenParams ?? {}),
    });
    // Korte busy-indicatie; de browser neemt de download over.
    setTimeout(() => {
      setBusy(false);
      onClose();
    }, 1200);
  }

  return (
    <Modal open={open} onClose={onClose} title="QR-codes downloaden" className="max-w-2xl">
      <div className="flex flex-col gap-6">
        {/* Bron */}
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-neutral-900">Welke apparaten?</h3>
          <div className="flex flex-col gap-2">
            {scopes.map((s) => (
              <label
                key={s.key}
                className={`flex cursor-pointer items-center justify-between rounded-xl border px-3.5 py-2.5 text-sm transition-colors ${
                  activeScope?.key === s.key
                    ? "border-accent bg-accent-soft"
                    : "border-border hover:bg-surface-1"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <input
                    type="radio"
                    name="qr-scope"
                    checked={activeScope?.key === s.key}
                    onChange={() => setScopeKey(s.key)}
                    className="accent-[var(--tenant-accent)]"
                  />
                  <span className="font-medium text-neutral-900">{s.label}</span>
                </span>
                <span className="tabular-nums text-neutral-500">{s.machines.length}</span>
              </label>
            ))}
          </div>
        </section>

        {/* Formaat */}
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-neutral-900">Formaat</h3>
          <div className="grid grid-cols-3 gap-2">
            {FORMATS.map((f) => {
              const active = options.format === f.value;
              return (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => set("format", f.value)}
                  className={`flex flex-col items-start gap-0.5 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                    active ? "border-accent bg-accent-soft" : "border-border hover:bg-surface-1"
                  }`}
                >
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-neutral-900">
                    {f.value === "pdf" ? <FileText className="size-4" /> : <Download className="size-4" />}
                    {f.label}
                  </span>
                  <span className="text-xs text-neutral-500">{f.hint}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Opmaak-opties (alleen PDF) */}
        {isPdf ? (
          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-neutral-900">Opmaak</h3>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm text-neutral-600">Kolommen per pagina</span>
              <div className="inline-flex overflow-hidden rounded-lg border border-border">
                {([2, 3] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => set("columns", c)}
                    className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                      options.columns === c
                        ? "bg-accent text-accent-foreground"
                        : "bg-surface-1 text-neutral-700 hover:bg-surface-2"
                    }`}
                  >
                    {c} × {LAYOUT_PRESETS[c].rows}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Toggle label="Snijlijnen" checked={options.cutMarks} onChange={(v) => set("cutMarks", v)} />
              <Toggle label="Logo tonen" checked={options.includeLogo} onChange={(v) => set("includeLogo", v)} />
              <Toggle label="Serienummer" checked={options.includeSerial} onChange={(v) => set("includeSerial", v)} />
              <Toggle label="Categorie" checked={options.includeCategory} onChange={(v) => set("includeCategory", v)} />
            </div>
          </section>
        ) : (
          <p className="rounded-xl bg-surface-1 px-3.5 py-2.5 text-xs text-neutral-500">
            Elke QR-code wordt een los bestand met een duidelijke naam
            (bijv. <span className="font-mono">Loopband-01.{options.format === "zip-svg" ? "svg" : "png"}</span>).
          </p>
        )}

        {/* Voorvertoning */}
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-neutral-900">Voorvertoning</h3>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <Stat value={count} label="apparaten" />
            {isPdf ? <Stat value={pages} label={pages === 1 ? "pagina" : "pagina's"} /> : null}
            <Stat value={preset.perPage} label="per A4" hidden={!isPdf} />
          </div>
          {isPdf ? <MockPage columns={options.columns} machines={machines} preset={preset} /> : null}
        </section>

        {/* Acties */}
        <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-surface-1"
          >
            Annuleren
          </button>
          <Button onClick={download} loading={busy} disabled={count === 0}>
            <QrCode className="size-4" />
            {count === 0 ? "Geen apparaten" : `Download (${count})`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-border px-3.5 py-2.5 text-sm text-neutral-800">
      <span
        className={`flex size-5 items-center justify-center rounded-md border transition-colors ${
          checked ? "border-accent bg-accent text-accent-foreground" : "border-neutral-300 bg-surface-1"
        }`}
      >
        {checked ? <Check className="size-3.5" /> : null}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      {label}
    </label>
  );
}

function Stat({ value, label, hidden }: { value: number; label: string; hidden?: boolean }) {
  if (hidden) return null;
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-xl font-bold tabular-nums text-neutral-900">{value}</span>
      <span className="text-neutral-500">{label}</span>
    </span>
  );
}

/** Lichte HTML/CSS-nabootsing van de A4-indeling (geen echte PDF-render). */
function MockPage({
  columns,
  machines,
  preset,
}: {
  columns: 2 | 3;
  machines: PreviewMachine[];
  preset: { columns: 2 | 3; rows: number; perPage: number };
}) {
  const cells = machines.slice(0, preset.perPage);
  const placeholders = Math.max(0, Math.min(preset.perPage, columns * 2) - cells.length);
  return (
    <div className="mx-auto w-full max-w-[240px]">
      <div
        className="grid gap-1.5 rounded-lg border border-border bg-white p-2 shadow-sm"
        style={{
          aspectRatio: "1 / 1.414",
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${preset.rows}, minmax(0, 1fr))`,
        }}
      >
        {cells.map((m) => (
          <div key={m.id} className="flex items-center gap-1 rounded border border-neutral-200 p-1">
            <div className="grid size-6 shrink-0 grid-cols-3 grid-rows-3 gap-px">
              {Array.from({ length: 9 }).map((_, i) => (
                <span key={i} className={i % 2 === 0 ? "bg-neutral-900" : "bg-transparent"} />
              ))}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[6px] font-semibold leading-tight text-neutral-800">{m.name}</p>
              <p className="text-[5px] leading-tight text-neutral-400">Nr. {m.number}</p>
            </div>
          </div>
        ))}
        {Array.from({ length: placeholders }).map((_, i) => (
          <div key={`ph-${i}`} className="rounded border border-dashed border-neutral-200" />
        ))}
      </div>
      <p className="mt-1.5 text-center text-xs text-neutral-400">A4 · schematische weergave</p>
    </div>
  );
}
