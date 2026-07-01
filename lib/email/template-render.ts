import "server-only";
import type { Locale } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { EmailBranding } from "@/lib/email/branding";
import { renderEmailLayout } from "@/lib/email/layout";
import { escapeHtml } from "@/lib/email/components";
import type { EmailMessage } from "@/lib/email/messages";
import {
  EMAIL_TEMPLATE_DEFS,
  emailContentFor,
  type EmailTemplateDef,
  type EmailTemplateKey,
} from "@/lib/email/template-defaults";

/** Placeholder-waarden (alles als string; null/undefined → lege string). */
export type TemplateData = Record<string, string | null | undefined>;

/**
 * Gelokaliseerde "automatisch bericht"-footerregel. Één plek zodat zowel de
 * DB-render (hieronder) als de code-composers (lib/email/messages.ts) dezelfde
 * tekst per taal gebruiken.
 */
export const EMAIL_FOOTER_AUTO: Record<Locale, string> = {
  NL: "Dit is een automatisch gegenereerd bericht — beantwoorden is niet nodig.",
  EN: "This is an automatically generated message — no reply needed.",
  FY: "Dit is in automatysk oanmakke berjocht — antwurdzje is net nedich.",
};

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
  /** Footer-reden (gelokaliseerd, mag placeholders bevatten). Default: def.reason (NL). */
  reason?: string;
  /** Footer "automatisch bericht"-regel (gelokaliseerd). Default: NL. */
  footerNote?: string;
  /** On-screen preview: forceer de lichte weergave (geen OS-dark-mode). */
  forceLightScheme?: boolean;
}): EmailMessage {
  const data = { ...buildBrandingData(opts.branding), ...opts.data };
  const subject = renderPlaceholders(opts.subject, data, false);
  const preheader = renderPlaceholders(opts.preheader, data, false);
  const contentHtml = renderPlaceholders(opts.bodyHtml, data, true);
  const reason = renderPlaceholders(opts.reason ?? opts.def.reason, data, false);

  const html = renderEmailLayout({
    branding: opts.branding,
    preheader,
    contentHtml,
    reason,
    footerNote: opts.footerNote ?? EMAIL_FOOTER_AUTO.NL,
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
 * Render een e-mail voor één taal. **Taal-isolatie**: er wordt NOOIT teruggevallen
 * op een andere taal — ontbreekt (of publiceerde niemand) de rij in deze taal, dan
 * gebruikt hij de **gelokaliseerde registry-standaard** (`emailContentFor`). Zo kan
 * het overschrijven van bv. de NL-template de FY-vertaling niet wissen. `mode:
 * "published"` (default) = live inhoud; `mode: "draft"` = werk-concept (preview).
 * Geeft altijd een `EmailMessage` terug (nooit `null`).
 */
export async function composeFromTemplate(opts: {
  key: EmailTemplateKey;
  locale?: Locale;
  branding: EmailBranding;
  data: TemplateData;
  mode?: ComposeMode;
}): Promise<EmailMessage> {
  const { key, branding, data } = opts;
  const locale = opts.locale ?? "NL";
  const mode = opts.mode ?? "published";
  const def = EMAIL_TEMPLATE_DEFS[key];
  const fallback = emailContentFor(key, locale);
  const footerNote = EMAIL_FOOTER_AUTO[locale] ?? EMAIL_FOOTER_AUTO.NL;

  const renderDefault = () =>
    renderTemplateMessage({
      def,
      subject: fallback.subject,
      preheader: fallback.preheader,
      bodyHtml: fallback.bodyHtml,
      reason: fallback.reason,
      footerNote,
      branding,
      data,
    });

  const template = await prisma.emailTemplate.findUnique({
    where: { key_locale: { key, locale } },
  });
  if (!template) return renderDefault();

  if (mode === "draft") {
    return renderTemplateMessage({
      def,
      subject: template.subject,
      preheader: template.preheader ?? fallback.preheader,
      bodyHtml: template.bodyHtml,
      reason: fallback.reason,
      footerNote,
      branding,
      data,
    });
  }

  // published-mode: alleen deze taal; niet gepubliceerd → gelokaliseerde standaard.
  if (template.publishedBodyHtml == null) return renderDefault();
  return renderTemplateMessage({
    def,
    subject: template.publishedSubject ?? fallback.subject,
    preheader: template.publishedPreheader ?? fallback.preheader,
    bodyHtml: template.publishedBodyHtml,
    reason: fallback.reason,
    footerNote,
    branding,
    data,
  });
}
