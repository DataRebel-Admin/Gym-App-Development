import "server-only";
import type { EmailTemplate, Locale } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  EMAIL_TEMPLATE_ORDER,
  emailContentFor,
  type EmailTemplateKey,
} from "@/lib/email/template-defaults";

/**
 * Server-side opslag voor e-mailtemplates. Templates worden lui geseed uit de
 * registry (lib/email/template-defaults.ts) zodat de editor altijd de huidige
 * standaardinhoud toont, ook voor een verse database. Idempotent.
 */

/** Maak de template-rij aan uit de defaults als 'ie nog niet bestaat. */
export async function ensureTemplate(
  key: EmailTemplateKey,
  locale: Locale = "NL"
): Promise<EmailTemplate> {
  const content = emailContentFor(key, locale);
  return prisma.emailTemplate.upsert({
    where: { key_locale: { key, locale } },
    update: {}, // bestaat al → niets overschrijven
    create: {
      key,
      locale,
      subject: content.subject,
      preheader: content.preheader,
      bodyHtml: content.bodyHtml,
      status: "DRAFT",
    },
  });
}

/** Zorg dat alle geregistreerde templates bestaan (voor het overzicht). */
export async function ensureAllTemplates(locale: Locale = "NL"): Promise<void> {
  await Promise.all(EMAIL_TEMPLATE_ORDER.map((key) => ensureTemplate(key, locale)));
}

/** Lijst voor het overzicht — geseed + gesorteerd op registry-volgorde. */
export async function listTemplates(locale: Locale = "NL"): Promise<EmailTemplate[]> {
  await ensureAllTemplates(locale);
  const rows = await prisma.emailTemplate.findMany({ where: { locale } });
  const byKey = new Map(rows.map((r) => [r.key, r]));
  return EMAIL_TEMPLATE_ORDER.map((key) => byKey.get(key)).filter(
    (r): r is EmailTemplate => Boolean(r)
  );
}
