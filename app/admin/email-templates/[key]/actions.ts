"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSuperadmin } from "@/lib/superadmin";
import { audit } from "@/lib/audit";
import { sendEmail } from "@/lib/email/send";
import { loadTenantBranding } from "@/lib/email/branding";
import {
  renderTemplateMessage,
  EMAIL_FOOTER_AUTO,
  type TemplateData,
} from "@/lib/email/template-render";
import { validateTemplate } from "@/lib/email/template-validate";
import {
  EMAIL_TEMPLATE_DEFS,
  emailContentFor,
  isEmailTemplateKey,
  type EmailTemplateDef,
} from "@/lib/email/template-defaults";
import { ensureTemplate } from "@/lib/email/template-store";
import {
  DEFAULT_EMAIL_HEADER_STYLE,
  HEADER_CSS_MAX_LENGTH,
  LOGO_WIDTH_MAX,
  LOGO_WIDTH_MIN,
  sanitizeHeaderStyle,
  type EmailHeaderStyle,
} from "@/lib/email/header-style";
import {
  clearEmailHeaderStyle,
  setEmailHeaderStyle,
} from "@/lib/platform-settings";

const keySchema = z.string().refine(isEmailTemplateKey, "Onbekende template");
const localeEnum = z.enum(["NL", "EN", "FY"]).default("NL");

/**
 * Opmaak van de bovenste balk. Optioneel op preview/testmail: de editor stuurt
 * de nog niet opgeslagen waarden mee zodat de preview meteen meebeweegt.
 */
const headerStyleSchema = z.object({
  barCss: z.string().max(HEADER_CSS_MAX_LENGTH),
  badgeCss: z.string().max(HEADER_CSS_MAX_LENGTH),
  logoCss: z.string().max(HEADER_CSS_MAX_LENGTH),
  wordmarkCss: z.string().max(HEADER_CSS_MAX_LENGTH),
  logoWidth: z.number().int().min(LOGO_WIDTH_MIN).max(LOGO_WIDTH_MAX),
});

const contentSchema = z.object({
  key: keySchema,
  locale: localeEnum,
  subject: z.string().max(300),
  preheader: z.string().max(300),
  bodyHtml: z.string().max(100_000),
});

/** Sample-/placeholderwaarden voor preview & testmail. */
function sampleData(def: EmailTemplateDef, useSample: boolean): TemplateData {
  return Object.fromEntries(
    def.placeholders.map((p) => [p.token, useSample ? p.sample : `[${p.label}]`])
  );
}

/**
 * Leg de (nog niet opgeslagen) koptekst-opmaak uit de editor over de branding,
 * zodat preview en testmail tonen wat de beheerder net heeft getypt. Zonder
 * meegestuurde stijl blijft de opgeslagen variant staan.
 */
function withPreviewHeader(
  branding: Awaited<ReturnType<typeof loadTenantBranding>>,
  style: EmailHeaderStyle | undefined
) {
  if (!style) return branding;
  const parsed = headerStyleSchema.safeParse(style);
  if (!parsed.success) return branding;
  return { ...branding, headerStyle: sanitizeHeaderStyle(parsed.data) };
}

export type SaveResult = { ok?: true; error?: string };

/** Sla het werk-concept op (autosave). Publiceert NIET. */
export async function saveDraft(input: {
  key: string;
  locale?: string;
  subject: string;
  preheader: string;
  bodyHtml: string;
}): Promise<SaveResult> {
  const admin = await requireSuperadmin();
  const parsed = contentSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ongeldige invoer" };
  }
  const { key, locale, subject, preheader, bodyHtml } = parsed.data;
  await ensureTemplate(key, locale);

  await prisma.emailTemplate.update({
    where: { key_locale: { key, locale } },
    data: {
      subject,
      preheader,
      bodyHtml,
      status: "DRAFT",
      updatedById: admin.id,
      updatedByEmail: admin.email,
    },
  });

  await audit("email.template.update", {
    actor: admin,
    targetType: "EmailTemplate",
    targetId: key,
    metadata: { key, name: EMAIL_TEMPLATE_DEFS[key].name },
  });

  revalidatePath("/admin/email-templates");
  return { ok: true };
}

export type PreviewResult = { html: string; subject: string };

/** Render de live preview voor de gekozen tenant + (optioneel) testgegevens. */
export async function renderPreview(input: {
  key: string;
  locale?: string;
  subject: string;
  preheader: string;
  bodyHtml: string;
  tenantId: string | null;
  useSampleData: boolean;
  /** Weergave in de preview-iframe: lichte of donkere mailclient. */
  scheme?: "light" | "dark";
  /** Nog niet opgeslagen koptekst-opmaak uit de editor. */
  headerStyle?: EmailHeaderStyle;
}): Promise<PreviewResult> {
  await requireSuperadmin();
  if (!isEmailTemplateKey(input.key)) {
    return { html: "<p>Onbekende template</p>", subject: "" };
  }
  const locale = localeEnum.parse(input.locale);
  const def = EMAIL_TEMPLATE_DEFS[input.key];
  const branding = withPreviewHeader(
    await loadTenantBranding(input.tenantId),
    input.headerStyle
  );
  const message = renderTemplateMessage({
    def,
    subject: input.subject,
    preheader: input.preheader,
    bodyHtml: input.bodyHtml,
    reason: emailContentFor(input.key, locale).reason,
    footerNote: EMAIL_FOOTER_AUTO[locale],
    branding,
    data: sampleData(def, input.useSampleData),
    // De preview forceert bewust één weergave i.p.v. mee te kleuren met de
    // browser/OS van de beheerder — zo is de dark-variant óók te controleren.
    // Testmails en echte verzendingen blijven "auto".
    scheme: input.scheme === "dark" ? "dark" : "light",
  });
  return { html: message.html, subject: message.subject };
}

const publishSchema = contentSchema.extend({
  note: z.string().max(500).optional(),
});

export type PublishResult = { ok?: true; error?: string; warnings?: string[] };

/** Valideer en publiceer: concept → gepubliceerde snapshot + versiegeschiedenis. */
export async function publishTemplate(input: {
  key: string;
  locale?: string;
  subject: string;
  preheader: string;
  bodyHtml: string;
  note?: string;
}): Promise<PublishResult> {
  const admin = await requireSuperadmin();
  const parsed = publishSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ongeldige invoer" };
  }
  const { key, locale, subject, preheader, bodyHtml, note } = parsed.data;

  const { errors, warnings } = validateTemplate({ key, subject, bodyHtml });
  if (errors.length > 0) {
    return { error: errors.join(" ") };
  }

  await ensureTemplate(key, locale);

  await prisma.$transaction(async (tx) => {
    const updated = await tx.emailTemplate.update({
      where: { key_locale: { key, locale } },
      data: {
        subject,
        preheader,
        bodyHtml,
        publishedSubject: subject,
        publishedPreheader: preheader,
        publishedBodyHtml: bodyHtml,
        publishedAt: new Date(),
        status: "PUBLISHED",
        updatedById: admin.id,
        updatedByEmail: admin.email,
      },
    });
    await tx.emailTemplateVersion.create({
      data: {
        templateId: updated.id,
        subject,
        preheader,
        bodyHtml,
        note: note?.trim() || null,
        authorId: admin.id,
        authorEmail: admin.email,
      },
    });
  });

  await audit("email.template.publish", {
    actor: admin,
    targetType: "EmailTemplate",
    targetId: key,
    metadata: { key, name: EMAIL_TEMPLATE_DEFS[key].name },
  });

  revalidatePath("/admin/email-templates");
  revalidatePath(`/admin/email-templates/${key}`);
  return { ok: true, warnings };
}

export type RestoreResult = {
  ok?: true;
  error?: string;
  content?: { subject: string; preheader: string; bodyHtml: string };
};

/** Laad een eerdere versie terug in het werk-concept (publiceert niet). */
export async function restoreVersion(input: {
  key: string;
  locale?: string;
  versionId: string;
}): Promise<RestoreResult> {
  const admin = await requireSuperadmin();
  if (!isEmailTemplateKey(input.key)) return { error: "Onbekende template" };

  const version = await prisma.emailTemplateVersion.findUnique({
    where: { id: input.versionId },
    include: { template: { select: { key: true, locale: true } } },
  });
  if (!version || version.template.key !== input.key) {
    return { error: "Versie niet gevonden" };
  }

  await prisma.emailTemplate.update({
    where: { key_locale: { key: input.key, locale: version.template.locale } },
    data: {
      subject: version.subject,
      preheader: version.preheader ?? "",
      bodyHtml: version.bodyHtml,
      status: "DRAFT",
      updatedById: admin.id,
      updatedByEmail: admin.email,
    },
  });

  await audit("email.template.restore", {
    actor: admin,
    targetType: "EmailTemplate",
    targetId: input.key,
    metadata: { key: input.key, name: EMAIL_TEMPLATE_DEFS[input.key].name, versionId: input.versionId },
  });

  revalidatePath("/admin/email-templates");
  return {
    ok: true,
    content: {
      subject: version.subject,
      preheader: version.preheader ?? "",
      bodyHtml: version.bodyHtml,
    },
  };
}

/** Zet het werk-concept terug naar de standaardinhoud uit de registry. */
export async function resetToDefault(input: {
  key: string;
  locale?: string;
}): Promise<RestoreResult> {
  const admin = await requireSuperadmin();
  if (!isEmailTemplateKey(input.key)) return { error: "Onbekende template" };
  const locale = localeEnum.parse(input.locale);
  const def = EMAIL_TEMPLATE_DEFS[input.key];
  const content = emailContentFor(input.key, locale);
  await ensureTemplate(input.key, locale);

  await prisma.emailTemplate.update({
    where: { key_locale: { key: input.key, locale } },
    data: {
      subject: content.subject,
      preheader: content.preheader,
      bodyHtml: content.bodyHtml,
      status: "DRAFT",
      updatedById: admin.id,
      updatedByEmail: admin.email,
    },
  });

  await audit("email.template.reset", {
    actor: admin,
    targetType: "EmailTemplate",
    targetId: input.key,
    metadata: { key: input.key, name: def.name },
  });

  revalidatePath("/admin/email-templates");
  return {
    ok: true,
    content: {
      subject: content.subject,
      preheader: content.preheader,
      bodyHtml: content.bodyHtml,
    },
  };
}

export type HeaderStyleResult = {
  ok?: true;
  error?: string;
  style?: EmailHeaderStyle;
};

/**
 * Sla de opmaak van de bovenste balk op. **Geldt voor álle mails en alle
 * sportscholen** — er is bewust geen concept/publiceer-stap zoals bij de
 * inhoud: het is één platforminstelling en de preview toont het resultaat al.
 */
export async function saveHeaderStyle(
  input: EmailHeaderStyle
): Promise<HeaderStyleResult> {
  const admin = await requireSuperadmin();
  const parsed = headerStyleSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ongeldige opmaak" };
  }
  const style = sanitizeHeaderStyle(parsed.data);
  await setEmailHeaderStyle(style, admin);

  await audit("email.header.update", {
    actor: admin,
    targetType: "PlatformSetting",
    targetId: "email.header.style",
    newValue: style,
  });

  revalidatePath("/admin/email-templates");
  return { ok: true, style };
}

/** Zet de koptekst-opmaak terug naar de code-standaard (verwijdert de rij). */
export async function resetHeaderStyle(): Promise<HeaderStyleResult> {
  const admin = await requireSuperadmin();
  await clearEmailHeaderStyle();

  await audit("email.header.reset", {
    actor: admin,
    targetType: "PlatformSetting",
    targetId: "email.header.style",
  });

  revalidatePath("/admin/email-templates");
  return { ok: true, style: DEFAULT_EMAIL_HEADER_STYLE };
}

const testSchema = contentSchema.extend({
  to: z.string().trim().email("Ongeldig e-mailadres"),
  tenantId: z.string().nullable(),
});

export type TestResult = { ok?: true; error?: string };

/** Verstuur een testmail (concept-inhoud + testgegevens) naar een eigen adres. */
export async function sendTestEmail(input: {
  key: string;
  locale?: string;
  subject: string;
  preheader: string;
  bodyHtml: string;
  to: string;
  tenantId: string | null;
  headerStyle?: EmailHeaderStyle;
}): Promise<TestResult> {
  const admin = await requireSuperadmin();
  const parsed = testSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ongeldige invoer" };
  }
  const { key, locale, subject, preheader, bodyHtml, to, tenantId } = parsed.data;
  const def = EMAIL_TEMPLATE_DEFS[key];
  const branding = withPreviewHeader(
    await loadTenantBranding(tenantId),
    input.headerStyle
  );

  const message = renderTemplateMessage({
    def,
    subject: `[TEST] ${subject}`,
    preheader,
    bodyHtml,
    reason: emailContentFor(key, locale).reason,
    footerNote: EMAIL_FOOTER_AUTO[locale],
    branding,
    data: sampleData(def, true),
  });

  try {
    await sendEmail({ to, message });
  } catch (err) {
    return { error: `Versturen mislukt: ${(err as Error).message}` };
  }

  await audit("email.test.send", {
    actor: admin,
    targetType: "EmailTemplate",
    targetId: key,
    metadata: { key, name: def.name, to },
  });

  return { ok: true };
}
