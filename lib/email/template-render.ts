import "server-only";
import type { Locale } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { EmailBranding } from "@/lib/email/branding";
import { renderEmailLayout } from "@/lib/email/layout";
import { escapeHtml } from "@/lib/email/components";
import type { EmailMessage } from "@/lib/email/messages";
import {
  EMAIL_TEMPLATE_DEFS,
  type EmailTemplateDef,
  type EmailTemplateKey,
} from "@/lib/email/template-defaults";

/** Placeholder-waarden (alles als string; null/undefined → lege string). */
export type TemplateData = Record<string, string | null | undefined>;

/**
 * Vervang elke `{{token}}` door de bijbehorende waarde. Onbekende tokens worden
 * leeg. In HTML-context (`escape: true`) wordt de waarde door `escapeHtml`
 * gehaald (anti-injectie voor gebruikers-/datawaarden); in platte-tekst-context
 * (subject/preheader) niet, omdat de mailclient die niet als HTML toont.
 */
export function renderPlaceholders(
  text: string,
  data: TemplateData,
  escape: boolean
): string {
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, token: string) => {
    const value = data[token];
    const str = value == null ? "" : String(value);
    return escape ? escapeHtml(str) : str;
  });
}

/** Globale placeholder-waarden afgeleid uit de tenant-branding (+ runtime). */
export function buildBrandingData(branding: EmailBranding): TemplateData {
  return {
    gymName: branding.name,
    currentYear: String(new Date().getFullYear()),
    accentColor: branding.accent,
    accentText: branding.accentText,
    logoUrl: branding.logoUrl ?? "",
    supportEmail: branding.contactEmail ?? "",
  };
}

/** Heel eenvoudige HTML→tekst voor het plain-text-alternatief van een testmail. */
function htmlToText(html: string): string {
  return html
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(p|h1|h2|h3|tr|div|table)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();
}

/**
 * Bouw een volledige `EmailMessage` uit expliciete template-inhoud + branding.
 * Gebruikt door zowel de live-preview/testmail (concept-inhoud uit de editor) als
 * `composeFromTemplate` (gepubliceerde inhoud uit de DB). De gebrande shell komt
 * altijd uit `renderEmailLayout` — de content kan die niet breken.
 */
export function renderTemplateMessage(opts: {
  def: EmailTemplateDef;
  subject: string;
  preheader: string;
  bodyHtml: string;
  branding: EmailBranding;
  data: TemplateData;
  /** On-screen preview: forceer de lichte weergave (geen OS-dark-mode). */
  forceLightScheme?: boolean;
}): EmailMessage {
  const data = { ...buildBrandingData(opts.branding), ...opts.data };
  const subject = renderPlaceholders(opts.subject, data, false);
  const preheader = renderPlaceholders(opts.preheader, data, false);
  const contentHtml = renderPlaceholders(opts.bodyHtml, data, true);
  const reason = renderPlaceholders(opts.def.reason, data, false);

  const html = renderEmailLayout({
    branding: opts.branding,
    preheader,
    contentHtml,
    reason,
    forceLightScheme: opts.forceLightScheme,
  });

  return {
    subject,
    html,
    text: `${htmlToText(contentHtml)}\n\n—\n${reason}`,
  };
}

type ComposeMode = "published" | "draft";

/**
 * Render een e-mail uit de DB-template. `mode: "published"` (default) levert de
 * gepubliceerde inhoud — of `null` als er nog niets is gepubliceerd, zodat de
 * call-site terugvalt op de hardgecodeerde composer (lib/email/messages.ts).
 * `mode: "draft"` rendert het werk-concept (voor preview/testmail).
 */
export async function composeFromTemplate(opts: {
  key: EmailTemplateKey;
  locale?: Locale;
  branding: EmailBranding;
  data: TemplateData;
  mode?: ComposeMode;
}): Promise<EmailMessage | null> {
  const { key, branding, data } = opts;
  const locale = opts.locale ?? "NL";
  const mode = opts.mode ?? "published";
  const def = EMAIL_TEMPLATE_DEFS[key];

  let template = await prisma.emailTemplate.findUnique({
    where: { key_locale: { key, locale } },
  });
  // NL is de hoofdtaal; val voor andere locales terug op NL als die er niet is.
  if (!template && locale !== "NL") {
    template = await prisma.emailTemplate.findUnique({
      where: { key_locale: { key, locale: "NL" } },
    });
  }
  if (!template) return null;

  if (mode === "published") {
    if (template.publishedBodyHtml == null) return null; // nog niet gepubliceerd
    return renderTemplateMessage({
      def,
      subject: template.publishedSubject ?? def.defaultSubject,
      preheader: template.publishedPreheader ?? def.defaultPreheader,
      bodyHtml: template.publishedBodyHtml,
      branding,
      data,
    });
  }

  return renderTemplateMessage({
    def,
    subject: template.subject,
    preheader: template.preheader ?? "",
    bodyHtml: template.bodyHtml,
    branding,
    data,
  });
}
