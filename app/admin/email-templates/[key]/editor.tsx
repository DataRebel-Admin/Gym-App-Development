"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { EditorView } from "@codemirror/view";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import type {
  PlaceholderDef,
  EmailTemplateKey,
} from "@/lib/email/template-defaults";
import { validateTemplate } from "@/lib/email/template-validate";
import {
  saveDraft,
  renderPreview,
  publishTemplate,
  restoreVersion,
  resetToDefault,
  sendTestEmail,
} from "./actions";

const CodeEditor = dynamic(() => import("./code-editor"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-neutral-400">
      Editor laden…
    </div>
  ),
});

type Tenant = { id: string; name: string; accentColor: string | null };
type Version = {
  id: string;
  subject: string;
  note: string | null;
  authorEmail: string | null;
  createdAt: string;
};
type Device = "desktop" | "tablet" | "mobile";

const DEVICE_WIDTH: Record<Device, string> = {
  desktop: "100%",
  tablet: "768px",
  mobile: "390px",
};

const DATE_FMT = new Intl.DateTimeFormat("nl-NL", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

type SaveState = "idle" | "saving" | "saved" | "error";

export function TemplateEditor({
  templateKey: templateKeyProp,
  locale,
  name,
  description,
  hasTrigger,
  placeholders,
  initial,
  versions: initialVersions,
  tenants,
  adminEmail,
}: {
  templateKey: EmailTemplateKey;
  locale: "NL" | "EN" | "FY";
  name: string;
  description: string;
  hasTrigger: boolean;
  placeholders: PlaceholderDef[];
  initial: {
    subject: string;
    preheader: string;
    bodyHtml: string;
    status: "DRAFT" | "PUBLISHED";
    publishedAt: string | null;
  };
  versions: Version[];
  tenants: Tenant[];
  adminEmail: string;
}) {
  const toast = useToast();
  const templateKey = templateKeyProp;

  const [subject, setSubject] = useState(initial.subject);
  const [preheader, setPreheader] = useState(initial.preheader);
  const [bodyHtml, setBodyHtml] = useState(initial.bodyHtml);
  const [status, setStatus] = useState(initial.status);
  const [publishedAt, setPublishedAt] = useState(initial.publishedAt);

  const [tenantId, setTenantId] = useState<string | null>(tenants[0]?.id ?? null);
  const [device, setDevice] = useState<Device>("desktop");
  const [useSampleData, setUseSampleData] = useState(true);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);

  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [publishOpen, setPublishOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [versions] = useState(initialVersions);

  const viewRef = useRef<EditorView | null>(null);

  const validation = useMemo(
    () =>
      validateTemplate({
        key: templateKey,
        subject,
        bodyHtml,
      }),
    [templateKey, subject, bodyHtml]
  );

  // ── Autosave (concept) ────────────────────────────────────────────────────
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const handle = setTimeout(async () => {
      setSaveState("saving");
      const res = await saveDraft({ key: templateKey, locale, subject, preheader, bodyHtml });
      if (res.ok) {
        setSaveState("saved");
        setStatus("DRAFT");
      } else {
        setSaveState("error");
        toast.error(res.error ?? "Opslaan mislukt");
      }
    }, 1100);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject, preheader, bodyHtml]);

  // ── Live preview (gedebounced) ────────────────────────────────────────────
  const previewReq = useRef(0);
  useEffect(() => {
    const reqId = ++previewReq.current;
    const handle = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const res = await renderPreview({
          key: templateKey,
          locale,
          subject,
          preheader,
          bodyHtml,
          tenantId,
          useSampleData,
        });
        if (reqId === previewReq.current) setPreviewHtml(res.html);
      } finally {
        if (reqId === previewReq.current) setPreviewLoading(false);
      }
    }, 400);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject, preheader, bodyHtml, tenantId, useSampleData]);

  const insertPlaceholder = useCallback((token: string) => {
    const view = viewRef.current;
    const snippet = `{{${token}}}`;
    if (!view) return;
    const { from, to } = view.state.selection.main;
    view.dispatch({
      changes: { from, to, insert: snippet },
      selection: { anchor: from + snippet.length },
    });
    view.focus();
  }, []);

  const applyContent = useCallback(
    (c: { subject: string; preheader: string; bodyHtml: string }) => {
      setSubject(c.subject);
      setPreheader(c.preheader);
      setBodyHtml(c.bodyHtml);
    },
    []
  );

  // ── Acties ────────────────────────────────────────────────────────────────
  const [publishing, setPublishing] = useState(false);
  const [publishNote, setPublishNote] = useState("");
  async function handlePublish() {
    setPublishing(true);
    const res = await publishTemplate({
      key: templateKey,
      locale,
      subject,
      preheader,
      bodyHtml,
      note: publishNote,
    });
    setPublishing(false);
    if (res.ok) {
      setStatus("PUBLISHED");
      setPublishedAt(new Date().toISOString());
      setPublishOpen(false);
      setPublishNote("");
      toast.success("Template gepubliceerd — staat nu live.");
    } else {
      toast.error(res.error ?? "Publiceren mislukt");
    }
  }

  const [testEmail, setTestEmail] = useState(adminEmail);
  const [sending, setSending] = useState(false);
  async function handleTest() {
    setSending(true);
    const res = await sendTestEmail({
      key: templateKey,
      locale,
      subject,
      preheader,
      bodyHtml,
      to: testEmail,
      tenantId,
    });
    setSending(false);
    if (res.ok) {
      setTestOpen(false);
      toast.success(`Testmail verstuurd naar ${testEmail}.`);
    } else {
      toast.error(res.error ?? "Versturen mislukt");
    }
  }

  async function handleRestore(versionId: string) {
    const res = await restoreVersion({ key: templateKey, locale, versionId });
    if (res.ok && res.content) {
      applyContent(res.content);
      setVersionsOpen(false);
      toast.success("Versie hersteld in het concept. Publiceer om live te zetten.");
    } else {
      toast.error(res.error ?? "Herstellen mislukt");
    }
  }

  async function handleReset() {
    const res = await resetToDefault({ key: templateKey, locale });
    if (res.ok && res.content) {
      applyContent(res.content);
      toast.success("Standaardinhoud hersteld in het concept.");
    } else {
      toast.error(res.error ?? "Herstellen mislukt");
    }
  }

  const saveLabel: Record<SaveState, string> = {
    idle: "Concept",
    saving: "Bezig met opslaan…",
    saved: "Concept opgeslagen",
    error: "Opslaan mislukt",
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Kop + acties */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-xl font-bold text-neutral-900">{name}</h1>
            {status === "PUBLISHED" && publishedAt ? (
              <Badge tone="success">Actief</Badge>
            ) : (
              <Badge tone="warning">Concept</Badge>
            )}
            {!hasTrigger ? (
              <Badge tone="neutral">Geen automatische trigger</Badge>
            ) : null}
          </div>
          <p className="mt-1 max-w-2xl text-sm text-neutral-500">{description}</p>
          <p className="mt-0.5 text-xs text-neutral-400">
            {saveLabel[saveState]}
            {publishedAt
              ? ` · laatst gepubliceerd ${DATE_FMT.format(new Date(publishedAt))}`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setVersionsOpen(true)}>
            Versies ({versions.length})
          </Button>
          <Button variant="ghost" size="sm" onClick={handleReset}>
            Herstel standaard
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setTestOpen(true)}>
            Verstuur testmail
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setPublishOpen(true)}
            disabled={validation.errors.length > 0}
          >
            Publiceren
          </Button>
        </div>
      </div>

      {/* Validatie-meldingen */}
      {(validation.errors.length > 0 || validation.warnings.length > 0) && (
        <div className="flex flex-col gap-1.5">
          {validation.errors.map((e) => (
            <p key={e} className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
              ⛔ {e}
            </p>
          ))}
          {validation.warnings.map((w) => (
            <p key={w} className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              ⚠️ {w}
            </p>
          ))}
        </div>
      )}

      {/* Split-screen */}
      <div className="grid min-h-[68vh] grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Editor-kant */}
        <Card className="flex min-h-[68vh] flex-col overflow-hidden p-0">
          <div className="flex flex-col gap-3 border-b border-border p-4">
            <Field label="Onderwerp">
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </Field>
            <Field label="Preheader" hint="Korte previewtekst in de inbox-lijst.">
              <Input value={preheader} onChange={(e) => setPreheader(e.target.value)} />
            </Field>
          </div>

          <div className="flex flex-wrap gap-1.5 border-b border-border p-3">
            <span className="mr-1 self-center text-xs font-medium text-neutral-500">
              Placeholders:
            </span>
            {placeholders.map((p) => (
              <button
                key={p.token}
                type="button"
                onClick={() => insertPlaceholder(p.token)}
                title={`${p.label} — voorbeeld: ${p.sample || "(leeg)"}`}
                className="rounded-md border border-border bg-surface-1 px-2 py-0.5 font-mono text-[11px] text-neutral-700 transition-colors hover:border-accent hover:text-accent"
              >
                {`{{${p.token}}}`}
                {p.required ? <span className="text-accent">*</span> : null}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            <CodeEditor
              value={bodyHtml}
              onChange={setBodyHtml}
              onCreateEditor={(view) => (viewRef.current = view)}
            />
          </div>
        </Card>

        {/* Preview-kant */}
        <Card className="flex min-h-[68vh] flex-col overflow-hidden p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-3">
            <div className="flex items-center gap-1 rounded-lg bg-surface-2 p-0.5">
              {(["desktop", "tablet", "mobile"] as Device[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDevice(d)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors",
                    device === d
                      ? "bg-surface-1 text-neutral-900 shadow-sm"
                      : "text-neutral-500 hover:text-neutral-900"
                  )}
                >
                  {d === "desktop" ? "Desktop" : d === "tablet" ? "Tablet" : "Mobiel"}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <select
                value={tenantId ?? ""}
                onChange={(e) => setTenantId(e.target.value || null)}
                className="rounded-lg border border-border bg-surface-1 px-2.5 py-1 text-xs text-neutral-900 outline-none focus:border-accent"
              >
                <option value="">GymRebel (standaard)</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-1.5 text-xs text-neutral-600">
                <input
                  type="checkbox"
                  checked={useSampleData}
                  onChange={(e) => setUseSampleData(e.target.checked)}
                  className="accent-accent"
                />
                Testgegevens
              </label>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto bg-neutral-100 p-3">
            <div className="mx-auto" style={{ width: DEVICE_WIDTH[device], maxWidth: "100%" }}>
              <iframe
                title="E-mailpreview"
                srcDoc={previewHtml}
                sandbox=""
                className={cn(
                  "h-[60vh] w-full rounded-lg border border-border bg-white transition-opacity",
                  previewLoading && "opacity-60"
                )}
              />
            </div>
          </div>
        </Card>
      </div>

      {/* Publiceer-modal */}
      <Modal open={publishOpen} onClose={() => setPublishOpen(false)} title="Template publiceren">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-neutral-600">
            Hiermee gaat deze inhoud direct live voor <strong>alle sportscholen</strong>.
            De huidige versie wordt bewaard in de geschiedenis.
          </p>
          {validation.warnings.length > 0 ? (
            <div className="flex flex-col gap-1">
              {validation.warnings.map((w) => (
                <p key={w} className="text-xs text-amber-700">⚠️ {w}</p>
              ))}
            </div>
          ) : null}
          <Field label="Opmerking (optioneel)" hint="Wat is er gewijzigd in deze versie?">
            <Input
              value={publishNote}
              onChange={(e) => setPublishNote(e.target.value)}
              placeholder="bv. Knoptekst aangepast"
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPublishOpen(false)}>
              Annuleren
            </Button>
            <Button variant="primary" loading={publishing} onClick={handlePublish}>
              Publiceren
            </Button>
          </div>
        </div>
      </Modal>

      {/* Testmail-modal */}
      <Modal open={testOpen} onClose={() => setTestOpen(false)} title="Testmail versturen">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-neutral-600">
            Verstuurt de huidige concept-inhoud met testgegevens en de huisstijl van de
            geselecteerde sportschool (
            {tenants.find((t) => t.id === tenantId)?.name ?? "GymRebel (standaard)"}).
          </p>
          <Field label="Naar e-mailadres">
            <Input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="jij@voorbeeld.nl"
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setTestOpen(false)}>
              Annuleren
            </Button>
            <Button variant="primary" loading={sending} onClick={handleTest} disabled={!testEmail}>
              Verstuur testmail
            </Button>
          </div>
        </div>
      </Modal>

      {/* Versies-modal */}
      <Modal open={versionsOpen} onClose={() => setVersionsOpen(false)} title="Versiegeschiedenis">
        {versions.length === 0 ? (
          <p className="text-sm text-neutral-500">
            Nog geen gepubliceerde versies. Publiceer om de eerste versie te bewaren.
          </p>
        ) : (
          <ul className="flex max-h-[60vh] flex-col divide-y divide-border overflow-auto">
            {versions.map((v) => (
              <li key={v.id} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-neutral-900">{v.subject}</p>
                  {v.note ? (
                    <p className="truncate text-xs text-neutral-500">{v.note}</p>
                  ) : null}
                  <p className="text-xs text-neutral-400">
                    {DATE_FMT.format(new Date(v.createdAt))}
                    {v.authorEmail ? ` · ${v.authorEmail}` : ""}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleRestore(v.id)}>
                  Herstellen
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  );
}
