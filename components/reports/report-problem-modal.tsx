"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Textarea, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Flag } from "@/components/ui/icons";
import { useReportContext } from "@/lib/hooks/use-report-context";
import type { ReportContext } from "@/lib/report-context";

export type ReportPrefill = {
  type?: "BUG" | "FEEDBACK" | "QUESTION";
  title?: string;
  description?: string;
  /** error.digest van een error boundary — gaat mee in de omschrijving. */
  digest?: string;
  /** Melding vanaf een crashscherm → severity HIGH server-side. */
  crash?: boolean;
};

const REPORT_TYPES = ["BUG", "FEEDBACK", "QUESTION"] as const;

// Volgorde + labels van de context-samenvatting ("Dit sturen we mee").
const CONTEXT_FIELDS: (keyof ReportContext)[] = [
  "route",
  "appVersion",
  "buildId",
  "platform",
  "osVersion",
  "screenSize",
  "locale",
  "userAgent",
];

/**
 * Meldformulier "Probleem melden" (aan de developers van de app — niet aan de
 * sportschool). Verzamelt automatisch technische context via
 * `useReportContext()` en toont die transparant vóór verzenden. Verstuurt via
 * `fetch` naar POST /api/reports (géén server action: hetzelfde endpoint dat
 * ook crashschermen zonder providers gebruiken).
 */
export function ReportProblemModal({
  open,
  onClose,
  prefill,
}: {
  open: boolean;
  onClose: () => void;
  prefill?: ReportPrefill;
}) {
  const t = useTranslations("report");
  const context = useReportContext();

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const [anonymous, setAnonymous] = useState(false);
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preview-object-URL netjes opruimen.
  useEffect(() => {
    return () => {
      if (screenshotPreview) URL.revokeObjectURL(screenshotPreview);
    };
  }, [screenshotPreview]);

  const reset = useCallback(() => {
    setPending(false);
    setError(null);
    setReference(null);
    setAnonymous(false);
    setScreenshotFile(null);
    setScreenshotPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
  }, []);

  const close = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  function onPickScreenshot(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setScreenshotFile(file);
    setScreenshotPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return file ? URL.createObjectURL(file) : null;
    });
  }

  function removeScreenshot() {
    setScreenshotFile(null);
    setScreenshotPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);

    const fields = new FormData(event.currentTarget);
    const data = new FormData();
    data.set("type", String(fields.get("type") ?? "BUG"));
    data.set("title", String(fields.get("title") ?? ""));
    let description = String(fields.get("description") ?? "");
    if (prefill?.digest) description += `\n\n[digest: ${prefill.digest}]`;
    data.set("description", description);
    data.set(
      "contactAllowed",
      !anonymous && fields.get("contactAllowed") === "on" ? "1" : "0"
    );
    data.set("anonymous", anonymous ? "1" : "0");
    data.set("crash", prefill?.crash ? "1" : "0");
    // Exact hetzelfde object als in de samenvatting hieronder — één bron van
    // waarheid; de server saneert nogmaals met de whitelist.
    data.set("context", JSON.stringify(context));
    if (screenshotFile) data.set("screenshot", screenshotFile);

    try {
      const res = await fetch("/api/reports", { method: "POST", body: data });
      if (res.status === 429) {
        setError(t("errors.rateLimited"));
      } else if (!res.ok) {
        setError(t("errors.generic"));
      } else {
        const body = (await res.json()) as { ref?: string };
        setReference(body.ref ?? "#—");
      }
    } catch {
      setError(t("errors.generic"));
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal open={open} onClose={close} title={t("title")} className="max-w-lg">
      {reference ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-accent-gradient text-accent-foreground">
            <Flag size={22} />
          </span>
          <p className="text-sm text-neutral-700">{t("success")}</p>
          <p className="text-lg font-semibold text-neutral-900">
            {t("reference", { ref: reference })}
          </p>
          <Button type="button" onClick={close}>
            {t("close")}
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <p className="text-sm text-neutral-600">{t("intro")}</p>

          <Field label={t("form.type")}>
            <Select name="type" defaultValue={prefill?.type ?? "BUG"}>
              {REPORT_TYPES.map((value) => (
                <option key={value} value={value}>
                  {t(`type.${value.toLowerCase()}`)}
                </option>
              ))}
            </Select>
          </Field>

          {/* Bij een crash-melding zijn titel + omschrijving voorgevuld, zodat
              versturen zonder iets in te vullen kan (route/versie/errors gaan
              automatisch mee). */}
          <Field label={t("form.title")} required>
            <Input
              name="title"
              required
              minLength={3}
              maxLength={150}
              defaultValue={prefill?.title ?? (prefill?.crash ? t("crash.title") : "")}
              placeholder={t("form.titlePlaceholder")}
            />
          </Field>

          <Field label={t("form.description")} required>
            <Textarea
              name="description"
              required
              minLength={10}
              maxLength={5000}
              rows={5}
              defaultValue={
                prefill?.description ?? (prefill?.crash ? t("crash.description") : "")
              }
              placeholder={t("form.descriptionPlaceholder")}
            />
          </Field>

          {/* Screenshot: opt-in en eerst zichtbaar — de gebruiker ziet wat hij verstuurt. */}
          <Field label={t("form.screenshot")} hint={t("form.screenshotHint")}>
            {screenshotPreview ? (
              <div className="flex items-start gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={screenshotPreview}
                  alt={t("form.screenshotPreviewAlt")}
                  className="max-h-40 rounded-xl border border-border object-contain"
                />
                <Button type="button" variant="ghost" onClick={removeScreenshot}>
                  {t("form.screenshotRemove")}
                </Button>
              </div>
            ) : (
              <input
                ref={fileInputRef}
                type="file"
                name="screenshot-picker"
                accept="image/*"
                onChange={onPickScreenshot}
                className="text-sm text-neutral-600 file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-neutral-700"
              />
            )}
          </Field>

          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={anonymous}
                onChange={(e) => setAnonymous(e.target.checked)}
                className="size-4 rounded accent-[var(--tenant-accent,#ff4d00)]"
              />
              {t("form.anonymous")}
            </label>
            <label
              className={`flex items-center gap-2 text-sm ${anonymous ? "text-neutral-400" : "text-neutral-700"}`}
            >
              <input
                type="checkbox"
                name="contactAllowed"
                disabled={anonymous}
                className="size-4 rounded accent-[var(--tenant-accent,#ff4d00)]"
              />
              {t("form.contactAllowed")}
            </label>
          </div>

          {/* Transparantie: exact wat er automatisch wordt meegestuurd. */}
          <details className="rounded-xl border border-border bg-surface-1 px-3 py-2">
            <summary className="cursor-pointer text-sm font-medium text-neutral-700">
              {t("context.heading")}
            </summary>
            <dl className="mt-2 flex flex-col gap-1 text-xs text-neutral-600">
              {CONTEXT_FIELDS.map((key) => {
                const value = context[key];
                if (!value || typeof value !== "string") return null;
                return (
                  <div key={key} className="grid grid-cols-[7rem_1fr] gap-2">
                    <dt className="font-medium text-neutral-500">
                      {t(`context.fields.${key}`)}
                    </dt>
                    <dd className="break-all">{value}</dd>
                  </div>
                );
              })}
              <div className="grid grid-cols-[7rem_1fr] gap-2">
                <dt className="font-medium text-neutral-500">
                  {t("context.fields.clientErrors")}
                </dt>
                <dd>
                  {context.clientErrors?.length
                    ? t("context.errorCount", { count: context.clientErrors.length })
                    : t("context.noErrors")}
                </dd>
              </div>
            </dl>
            <p className="mt-2 text-xs text-neutral-500">{t("context.privacy")}</p>
          </details>

          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <div className="flex items-center justify-end gap-3">
            <Button type="button" variant="ghost" onClick={close} disabled={pending}>
              {t("cancel")}
            </Button>
            <Button type="submit" loading={pending}>
              {t("submit")}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

/**
 * Zelfstandige trigger + modal — voor plekken zonder eigen open-state
 * (foutpagina's, member-drawer). `variant="error"` rendert een outline-knop,
 * `variant="drawer"` een menu-regel.
 */
export function ReportProblemButton({
  variant = "error",
  prefill,
  label,
  className,
  onOpen,
}: {
  variant?: "error" | "drawer";
  prefill?: ReportPrefill;
  /** Overschrijft het standaardlabel (bv. vertaald via de errors-namespace). */
  label?: string;
  className?: string;
  onOpen?: () => void;
}) {
  const t = useTranslations("report");
  const [open, setOpen] = useState(false);
  const text = label ?? t("button");

  return (
    <>
      {variant === "drawer" ? (
        <button
          type="button"
          onClick={() => {
            onOpen?.();
            setOpen(true);
          }}
          className={
            className ??
            "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
          }
        >
          <Flag size={18} className="shrink-0 text-neutral-400" />
          {text}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => {
            onOpen?.();
            setOpen(true);
          }}
          className={
            className ??
            "inline-flex items-center gap-2 rounded-xl border border-border bg-surface-1 px-4 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 focus-ring"
          }
        >
          <Flag size={16} />
          {text}
        </button>
      )}
      <ReportProblemModal open={open} onClose={() => setOpen(false)} prefill={prefill} />
    </>
  );
}
