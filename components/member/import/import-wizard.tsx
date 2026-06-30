"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, m } from "motion/react";
import { fade } from "@/components/motion/variants";
import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import { Button } from "@/components/ui/button";
import { buttonClasses } from "@/components/ui/button-classes";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/field";
import { ProgressBar } from "@/components/ui/progress-bar";
import { TableWrap, Table, Thead, Th, Tbody, Tr, Td } from "@/components/ui/table";
import { cn } from "@/lib/cn";
import {
  IMPORT_FIELDS,
  autoMapColumns,
  validateRows,
  summarize,
  normalizeEmail,
  type ColumnMapping,
  type ImportFieldKey,
  type RawRow,
  type ValidatedRow,
} from "@/lib/member-import";
import { Stepper, type StepDef } from "./stepper";
import { importMembersChunk, logImport, sendImportInvites } from "@/app/owner/members/import/actions";

const STEPS: StepDef[] = [
  { id: 1, label: "Uploaden" },
  { id: 2, label: "Koppelen" },
  { id: 3, label: "Controle" },
  { id: 4, label: "Preview" },
  { id: 5, label: "Importeren" },
  { id: 6, label: "Resultaat" },
];

const CHUNK_SIZE = 100;

type Progress = { processed: number; total: number; created: number; skipped: number };
type ResultState = {
  created: number;
  skipped: number;
  errored: number;
  createdMembers: { email: string; name: string }[];
};

// --- Bestand parsen ----------------------------------------------------------

async function parseFile(file: File): Promise<{ headers: string[]; rows: RawRow[] }> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return { headers: [], rows: [] };
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
  });
  if (aoa.length === 0) return { headers: [], rows: [] };

  const headers = (aoa[0] as unknown[]).map((h) => String(h ?? "").trim());
  const toCell = (v: unknown): string => {
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    return v == null ? "" : String(v).trim();
  };
  const rows = aoa.slice(1).map((r) => headers.map((_, i) => toCell((r as unknown[])[i])));
  return { headers, rows };
}

// --- Foutenrapport (client-side CSV) -----------------------------------------

function downloadBlob(content: BlobPart, type: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadErrorReport(validated: ValidatedRow[]) {
  const escape = (v: string) => (/[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = [["Regel", "E-mailadres", "Veld", "Probleem"].join(",")];
  for (const row of validated) {
    for (const issue of row.errors) {
      lines.push(
        [String(row.rowNumber), row.values.email, issue.field, issue.message].map(escape).join(",")
      );
    }
  }
  downloadBlob("﻿" + lines.join("\r\n"), "text/csv;charset=utf-8", "import-fouten.csv");
}

// --- Hoofdcomponent ----------------------------------------------------------

export function ImportWizard({ existingEmails }: { existingEmails: string[] }) {
  const [step, setStep] = useState(1);
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<RawRow[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [progress, setProgress] = useState<Progress>({ processed: 0, total: 0, created: 0, skipped: 0 });
  const [result, setResult] = useState<ResultState | null>(null);

  const existingSet = useMemo(
    () => new Set(existingEmails.map(normalizeEmail)),
    [existingEmails]
  );

  const validated = useMemo(
    () => validateRows(rows, mapping, { existingEmails: existingSet }),
    [rows, mapping, existingSet]
  );
  const summary = useMemo(() => summarize(validated), [validated]);

  const mappedKeys = useMemo(
    () => new Set(mapping.filter((k): k is ImportFieldKey => k !== null)),
    [mapping]
  );
  const missingRequired = IMPORT_FIELDS.filter((f) => f.required && !mappedKeys.has(f.key));

  const handleFile = useCallback(async (file: File) => {
    setParsing(true);
    setParseError(null);
    try {
      const parsed = await parseFile(file);
      if (parsed.headers.length === 0 || parsed.rows.length === 0) {
        setParseError("Het bestand bevat geen rijen. Controleer of er een kopregel én gegevens in staan.");
        setParsing(false);
        return;
      }
      setFileName(file.name);
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      setMapping(autoMapColumns(parsed.headers));
      setStep(2);
    } catch (err) {
      console.error(err);
      setParseError("Kon het bestand niet lezen. Gebruik een geldig .csv- of .xlsx-bestand.");
    } finally {
      setParsing(false);
    }
  }, []);

  const reset = useCallback(() => {
    setStep(1);
    setFileName("");
    setHeaders([]);
    setRows([]);
    setMapping([]);
    setParseError(null);
    setResult(null);
    setProgress({ processed: 0, total: 0, created: 0, skipped: 0 });
  }, []);

  const runImport = useCallback(async () => {
    const valid = validated.filter((r) => !r.skipped && r.errors.length === 0);
    setProgress({ processed: 0, total: valid.length, created: 0, skipped: 0 });
    setStep(5);

    let created = 0;
    let skipped = 0;
    const createdEmails = new Set<string>();
    for (let i = 0; i < valid.length; i += CHUNK_SIZE) {
      const slice = valid.slice(i, i + CHUNK_SIZE);
      try {
        const res = await importMembersChunk(slice.map((r) => r.values));
        created += res.created;
        skipped += res.skipped;
        res.createdEmails.forEach((e) => createdEmails.add(e));
      } catch (err) {
        console.error(err);
        skipped += slice.length;
      }
      setProgress({
        processed: Math.min(i + CHUNK_SIZE, valid.length),
        total: valid.length,
        created,
        skipped,
      });
    }

    await logImport({ created, skipped });

    const nameByEmail = new Map(
      valid.map((r) => [r.values.email, `${r.values.firstName} ${r.values.lastName}`.trim()])
    );
    setResult({
      created,
      skipped,
      errored: summary.errored,
      createdMembers: [...createdEmails].map((email) => ({
        email,
        name: nameByEmail.get(email) || email,
      })),
    });
    setStep(6);
  }, [validated, summary.errored]);

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <SectionHeading
        title="Leden importeren"
        description="Voeg in enkele minuten je volledige ledenbestand toe vanuit een CSV- of Excel-bestand."
        action={
          <Link href="/owner/members" className={buttonClasses({ variant: "ghost", size: "sm" })}>
            ← Terug naar leden
          </Link>
        }
      />

      <Card className="p-5">
        <Stepper steps={STEPS} current={step} />
      </Card>

      <AnimatePresence mode="wait">
        <m.div key={step} variants={fade} initial="hidden" animate="show" exit="exit">
          {step === 1 ? (
            <UploadStep
              parsing={parsing}
              error={parseError}
              onFile={handleFile}
            />
          ) : step === 2 ? (
            <MappingStep
              headers={headers}
              rows={rows}
              mapping={mapping}
              missingRequired={missingRequired}
              onChange={setMapping}
              onBack={reset}
              onNext={() => setStep(3)}
            />
          ) : step === 3 ? (
            <ValidationStep
              validated={validated}
              summary={summary}
              missingRequired={missingRequired}
              onBack={() => setStep(2)}
              onNext={() => setStep(4)}
            />
          ) : step === 4 ? (
            <PreviewStep
              validated={validated}
              summary={summary}
              fileName={fileName}
              onBack={() => setStep(3)}
              onImport={runImport}
            />
          ) : step === 5 ? (
            <ImportProgressStep progress={progress} />
          ) : result ? (
            <ResultStep result={result} onErrorReport={() => downloadErrorReport(validated)} onReset={reset} />
          ) : null}
        </m.div>
      </AnimatePresence>
    </div>
  );
}

// --- Stap 1: upload ----------------------------------------------------------

function UploadStep({
  parsing,
  error,
  onFile,
}: {
  parsing: boolean;
  error: string | null;
  onFile: (file: File) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Downloads (route-handler met Content-Disposition) → echte browser-GET via
  // <a>, geen client-side <Link>. Href als expressie zodat de pages-lintregel
  // 'm niet als paginanavigatie aanziet.
  const templateUrl = (format: "csv" | "xlsx") => `/owner/members/import/template?format=${format}`;

  return (
    <Card className="flex flex-col gap-5 p-6">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) onFile(file);
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-colors",
          dragging ? "border-accent bg-accent-soft" : "border-border hover:border-border-strong hover:bg-neutral-50"
        )}
      >
        <div className="text-5xl" aria-hidden>
          {parsing ? "⏳" : "📤"}
        </div>
        <p className="text-base font-semibold text-neutral-900">
          {parsing ? "Bestand wordt gelezen…" : "Sleep je bestand hierheen"}
        </p>
        <p className="text-sm text-neutral-500">
          of <span className="font-medium text-accent">kies een bestand</span> van je computer
        </p>
        <div className="mt-1 flex items-center gap-2">
          <Badge tone="neutral">.csv</Badge>
          <Badge tone="neutral">.xlsx</Badge>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
            e.target.value = "";
          }}
        />
      </div>

      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}

      <div className="flex flex-col gap-2 rounded-xl bg-surface-2 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-neutral-900">Weet je niet hoe te beginnen?</p>
          <p className="text-sm text-neutral-500">
            Download een voorbeeldbestand met de juiste kolomnamen en vul het in.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a href={templateUrl("csv")} className={buttonClasses({ variant: "outline", size: "sm" })}>
            CSV-template
          </a>
          <a href={templateUrl("xlsx")} className={buttonClasses({ variant: "outline", size: "sm" })}>
            Excel-template
          </a>
        </div>
      </div>
    </Card>
  );
}

// --- Stap 2: kolommen koppelen ----------------------------------------------

function MappingStep({
  headers,
  rows,
  mapping,
  missingRequired,
  onChange,
  onBack,
  onNext,
}: {
  headers: string[];
  rows: RawRow[];
  mapping: ColumnMapping;
  missingRequired: { key: ImportFieldKey; label: string }[];
  onChange: (m: ColumnMapping) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const autoMapped = useMemo(() => autoMapColumns(headers), [headers]);

  const setColumn = (index: number, key: ImportFieldKey | null) => {
    const next = [...mapping];
    // Een doelveld is uniek — verwijder een bestaande koppeling elders.
    if (key) next.forEach((k, i) => i !== index && k === key && (next[i] = null));
    next[index] = key;
    onChange(next);
  };

  return (
    <Card className="flex flex-col gap-5 p-6">
      <div>
        <h2 className="text-base font-semibold text-neutral-900">Koppel de kolommen</h2>
        <p className="text-sm text-neutral-500">
          We herkenden de meeste kolommen automatisch. Controleer en pas waar nodig aan.
        </p>
      </div>

      <TableWrap>
        <Table>
          <Thead>
            <tr>
              <Th>Kolom in je bestand</Th>
              <Th>Voorbeeldwaarde</Th>
              <Th>Koppel aan veld</Th>
            </tr>
          </Thead>
          <Tbody>
            {headers.map((header, i) => {
              const sample = rows.find((r) => (r[i] ?? "").trim() !== "")?.[i] ?? "—";
              const wasAuto = autoMapped[i] !== null && autoMapped[i] === mapping[i];
              return (
                <Tr key={i}>
                  <Td className="font-medium">{header || <span className="text-neutral-400">(naamloos)</span>}</Td>
                  <Td className="text-neutral-500">{sample}</Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <Select
                        value={mapping[i] ?? ""}
                        onChange={(e) => setColumn(i, (e.target.value || null) as ImportFieldKey | null)}
                        className="h-9 w-52 py-1"
                      >
                        <option value="">— Negeren —</option>
                        {IMPORT_FIELDS.map((f) => (
                          <option key={f.key} value={f.key}>
                            {f.label}
                            {f.required ? " *" : ""}
                          </option>
                        ))}
                      </Select>
                      {wasAuto ? <Badge tone="success">auto</Badge> : null}
                    </div>
                  </Td>
                </Tr>
              );
            })}
          </Tbody>
        </Table>
      </TableWrap>

      {missingRequired.length > 0 ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Koppel de verplichte velden:{" "}
          <strong>{missingRequired.map((f) => f.label).join(", ")}</strong>.
        </p>
      ) : null}

      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack}>
          ← Ander bestand
        </Button>
        <Button onClick={onNext} disabled={missingRequired.length > 0}>
          Controleren →
        </Button>
      </div>
    </Card>
  );
}

// --- Stap 3: validatie -------------------------------------------------------

function ValidationStep({
  validated,
  summary,
  missingRequired,
  onBack,
  onNext,
}: {
  validated: ValidatedRow[];
  summary: ReturnType<typeof summarize>;
  missingRequired: { key: ImportFieldKey; label: string }[];
  onBack: () => void;
  onNext: () => void;
}) {
  const issueRows = validated.filter((r) => r.errors.length > 0 || r.warnings.length > 0);

  return (
    <Card className="flex flex-col gap-5 p-6">
      <div>
        <h2 className="text-base font-semibold text-neutral-900">Controle</h2>
        <p className="text-sm text-neutral-500">
          We hebben elke regel gecontroleerd op verplichte velden, geldige en dubbele e-mailadressen.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Geldig" value={summary.valid} tone="success" />
        <StatTile label="Fouten" value={summary.errored} tone="danger" />
        <StatTile label="Waarschuwingen" value={summary.warned} tone="warning" />
        <StatTile label="Lege regels" value={summary.skipped} tone="neutral" />
      </div>

      {issueRows.length > 0 ? (
        <div className="max-h-80 overflow-y-auto rounded-xl border border-border">
          <Table>
            <Thead>
              <tr>
                <Th className="w-16">Regel</Th>
                <Th>E-mailadres</Th>
                <Th>Bevindingen</Th>
              </tr>
            </Thead>
            <Tbody>
              {issueRows.map((row) => (
                <Tr key={row.rowNumber}>
                  <Td className="text-neutral-500">{row.rowNumber}</Td>
                  <Td>{row.values.email || <span className="text-neutral-400">—</span>}</Td>
                  <Td>
                    <div className="flex flex-col gap-1">
                      {row.errors.map((issue, i) => (
                        <span key={`e${i}`} className="text-xs text-red-600">
                          ✕ {issue.message}
                        </span>
                      ))}
                      {row.warnings.map((issue, i) => (
                        <span key={`w${i}`} className="text-xs text-amber-600">
                          ! {issue.message}
                        </span>
                      ))}
                    </div>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </div>
      ) : (
        <p className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">
          ✓ Geen problemen gevonden — alle regels zijn klaar om te importeren.
        </p>
      )}

      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack}>
          ← Kolommen
        </Button>
        <Button onClick={onNext} disabled={missingRequired.length > 0 || summary.valid === 0}>
          Naar preview →
        </Button>
      </div>
    </Card>
  );
}

// --- Stap 4: preview ---------------------------------------------------------

function PreviewStep({
  validated,
  summary,
  fileName,
  onBack,
  onImport,
}: {
  validated: ValidatedRow[];
  summary: ReturnType<typeof summarize>;
  fileName: string;
  onBack: () => void;
  onImport: () => void;
}) {
  const preview = validated.filter((r) => !r.skipped && r.errors.length === 0).slice(0, 10);

  return (
    <Card className="flex flex-col gap-5 p-6">
      <div>
        <h2 className="text-base font-semibold text-neutral-900">Preview</h2>
        <p className="text-sm text-neutral-500">
          Uit <strong>{fileName}</strong> — een voorbeeld van de eerste records die geïmporteerd worden.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <Badge tone="success">{summary.valid} importeren</Badge>
        {summary.errored > 0 ? <Badge tone="danger">{summary.errored} fouten (overgeslagen)</Badge> : null}
        {summary.skipped > 0 ? <Badge tone="neutral">{summary.skipped} lege regels</Badge> : null}
        {summary.warned > 0 ? <Badge tone="warning">{summary.warned} met waarschuwing</Badge> : null}
      </div>

      <TableWrap>
        <Table>
          <Thead>
            <tr>
              <Th>Naam</Th>
              <Th>E-mailadres</Th>
              <Th>Telefoon</Th>
              <Th>Geboortedatum</Th>
              <Th>Lidnummer</Th>
              <Th>Rol</Th>
            </tr>
          </Thead>
          <Tbody>
            {preview.map((row) => (
              <Tr key={row.rowNumber}>
                <Td className="font-medium">
                  {`${row.values.firstName} ${row.values.lastName}`.trim()}
                </Td>
                <Td>{row.values.email}</Td>
                <Td className="text-neutral-500">{row.values.phone || "—"}</Td>
                <Td className="text-neutral-500">{row.values.birthDate || "—"}</Td>
                <Td className="text-neutral-500">{row.values.memberNumber || "—"}</Td>
                <Td>
                  <Badge tone={row.values.role === "TENANT_ADMIN" ? "accent" : "neutral"}>
                    {row.values.role === "TENANT_ADMIN" ? "Beheerder" : "Lid"}
                  </Badge>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </TableWrap>

      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack}>
          ← Controle
        </Button>
        <Button onClick={onImport} disabled={summary.valid === 0}>
          {summary.valid} leden importeren →
        </Button>
      </div>
    </Card>
  );
}

// --- Stap 5: voortgang -------------------------------------------------------

function ImportProgressStep({ progress }: { progress: Progress }) {
  const pct = progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0;
  return (
    <Card className="flex flex-col items-center gap-6 p-10 text-center">
      <div className="text-5xl" aria-hidden>
        🚀
      </div>
      <div>
        <p className="text-lg font-semibold text-neutral-900">Leden worden geïmporteerd…</p>
        <p className="text-sm text-neutral-500">Sluit dit venster niet tijdens het importeren.</p>
      </div>
      <div className="w-full max-w-md">
        <ProgressBar value={pct} gradient />
        <div className="mt-2 flex items-center justify-between text-sm text-neutral-600">
          <span>
            {progress.processed} / {progress.total} verwerkt
          </span>
          <span className="font-semibold text-accent">{pct}%</span>
        </div>
      </div>
      <div className="flex gap-6 text-sm">
        <span className="text-green-600">✓ {progress.created} aangemaakt</span>
        <span className="text-neutral-500">↷ {progress.skipped} overgeslagen</span>
      </div>
    </Card>
  );
}

// --- Stap 6: resultaat -------------------------------------------------------

function ResultStep({
  result,
  onErrorReport,
  onReset,
}: {
  result: ResultState;
  onErrorReport: () => void;
  onReset: () => void;
}) {
  return (
    <Card className="flex flex-col gap-6 p-6">
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <m.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
          className="flex size-16 items-center justify-center rounded-full bg-green-100 text-3xl"
        >
          🎉
        </m.div>
        <h2 className="font-display text-2xl font-bold text-neutral-900">Import voltooid!</h2>
        <p className="text-sm text-neutral-500">
          <strong className="text-green-600">{result.created}</strong> leden toegevoegd
          {result.skipped > 0 ? `, ${result.skipped} overgeslagen` : ""}
          {result.errored > 0 ? `, ${result.errored} met fouten` : ""}.
        </p>
      </div>

      {result.errored > 0 ? (
        <div className="flex items-center justify-between rounded-xl bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-700">
            {result.errored} regels hadden fouten en zijn overgeslagen.
          </p>
          <button onClick={onErrorReport} className={buttonClasses({ variant: "outline", size: "sm" })}>
            Foutenrapport ↓
          </button>
        </div>
      ) : null}

      {result.createdMembers.length > 0 ? (
        <InviteSection members={result.createdMembers} />
      ) : null}

      <div className="flex items-center justify-between border-t border-border pt-5">
        <Button variant="ghost" onClick={onReset}>
          Nog een bestand importeren
        </Button>
        <Link href="/owner/members" className={buttonClasses({ variant: "secondary" })}>
          Naar ledenlijst →
        </Link>
      </div>
    </Card>
  );
}

type InviteMode = "all" | "selected" | "later";

function InviteSection({ members }: { members: { email: string; name: string }[] }) {
  const [mode, setMode] = useState<InviteMode>("all");
  const [selected, setSelected] = useState<Set<string>>(() => new Set(members.map((m) => m.email)));
  const [sending, setSending] = useState(false);
  const [sentCount, setSentCount] = useState<number | null>(null);

  const toggle = (email: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  };

  const send = async () => {
    const emails = mode === "all" ? members.map((m) => m.email) : [...selected];
    if (emails.length === 0) return;
    setSending(true);
    try {
      const res = await sendImportInvites(emails);
      setSentCount(res.invited);
    } finally {
      setSending(false);
    }
  };

  if (sentCount !== null) {
    return (
      <div className="rounded-xl bg-green-50 px-4 py-4 text-sm text-green-700">
        ✓ {sentCount} uitnodiging{sentCount === 1 ? "" : "en"} verzonden. De nieuwe leden ontvangen
        een e-mail om hun account te activeren.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border p-4">
      <div>
        <h3 className="text-sm font-semibold text-neutral-900">Uitnodigingen versturen</h3>
        <p className="text-sm text-neutral-500">
          Nodig de zojuist geïmporteerde leden uit om hun account te activeren.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <RadioRow
          checked={mode === "all"}
          onSelect={() => setMode("all")}
          label={`Alle ${members.length} nieuwe leden uitnodigen`}
        />
        <RadioRow
          checked={mode === "selected"}
          onSelect={() => setMode("selected")}
          label="Alleen geselecteerde leden uitnodigen"
        />
        <RadioRow checked={mode === "later"} onSelect={() => setMode("later")} label="Later uitnodigen" />
      </div>

      {mode === "selected" ? (
        <div className="max-h-56 overflow-y-auto rounded-lg border border-border">
          {members.map((mbr) => (
            <label
              key={mbr.email}
              className="flex cursor-pointer items-center gap-3 border-b border-border px-3 py-2 text-sm last:border-0 hover:bg-neutral-50"
            >
              <input
                type="checkbox"
                checked={selected.has(mbr.email)}
                onChange={() => toggle(mbr.email)}
              />
              <span className="font-medium text-neutral-900">{mbr.name}</span>
              <span className="text-neutral-500">{mbr.email}</span>
            </label>
          ))}
        </div>
      ) : null}

      {mode !== "later" ? (
        <div>
          <Button onClick={send} loading={sending}>
            {mode === "all"
              ? `${members.length} leden uitnodigen`
              : `${selected.size} geselecteerde uitnodigen`}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function RadioRow({
  checked,
  onSelect,
  label,
}: {
  checked: boolean;
  onSelect: () => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 text-sm text-neutral-700">
      <input type="radio" checked={checked} onChange={onSelect} />
      {label}
    </label>
  );
}

function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "danger" | "warning" | "neutral";
}) {
  const toneClass = {
    success: "text-green-600",
    danger: "text-red-600",
    warning: "text-amber-600",
    neutral: "text-neutral-700",
  }[tone];
  return (
    <div className="rounded-xl border border-border bg-surface-1 px-4 py-3">
      <p className={cn("text-2xl font-bold", toneClass)}>{value}</p>
      <p className="text-xs text-neutral-500">{label}</p>
    </div>
  );
}
