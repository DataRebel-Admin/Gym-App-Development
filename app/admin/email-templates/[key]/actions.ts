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
  type TemplateData,
} from "@/lib/email/template-render";
import { validateTemplate } from "@/lib/email/template-validate";
import {
  EMAIL_TEMPLATE_DEFS,
  isEmailTemplateKey,
  type EmailTemplateDef,
} from "@/lib/email/template-defaults";
import { ensureTemplate } from "@/lib/email/template-store";

const keySchema = z.string().refine(isEmailTemplateKey, "Onbekende template");

const contentSchema = z.object({
  key: keySchema,
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

export type SaveResult = { ok?: true; error?: string };

/** Sla het werk-concept op (autosave). Publiceert NIET. */
export async function saveDraft(input: {
  key: string;
  subject: string;
  preheader: string;
  bodyHtml: string;
}): Promise<SaveResult> {
  const admin = await requireSuperadmin();
  const parsed = contentSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ongeldige invoer" };
  }
  const { key, subject, preheader, bodyHtml } = parsed.data;
  await ensureTemplate(key);

  await prisma.emailTemplate.update({
    where: { key_locale: { key, locale: "NL" } },
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
  subject: string;
  preheader: string;
  bodyHtml: string;
  tenantId: string | null;
  useSampleData: boolean;
}): Promise<PreviewResult> {
  await requireSuperadmin();
  if (!isEmailTemplateKey(input.key)) {
    return { html: "<p>Onbekende template</p>", subject: "" };
  }
  const def = EMAIL_TEMPLATE_DEFS[input.key];
  const branding = await loadTenantBranding(input.tenantId);
  const message = renderTemplateMessage({
    def,
    subject: input.subject,
    preheader: input.preheader,
    bodyHtml: input.bodyHtml,
    branding,
    data: sampleData(def, input.useSampleData),
    // On-screen preview altijd in de canonieke lichte weergave (niet meekleuren
    // met de dark-mode van de browser van de beheerder). Testmails blijven auto.
    forceLightScheme: true,
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
  const { key, subject, preheader, bodyHtml, note } = parsed.data;

  const { errors, warnings } = validateTemplate({ key, subject, bodyHtml });
  if (errors.length > 0) {
    return { error: errors.join(" ") };
  }

  await ensureTemplate(key);

  await prisma.$transaction(async (tx) => {
    const updated = await tx.emailTemplate.update({
      where: { key_locale: { key, locale: "NL" } },
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
  versionId: string;
}): Promise<RestoreResult> {
  const admin = await requireSuperadmin();
  if (!isEmailTemplateKey(input.key)) return { error: "Onbekende template" };

  const version = await prisma.emailTemplateVersion.findUnique({
    where: { id: input.versionId },
    include: { template: { select: { key: true } } },
  });
  if (!version || version.template.key !== input.key) {
    return { error: "Versie niet gevonden" };
  }

  await prisma.emailTemplate.update({
    where: { key_locale: { key: input.key, locale: "NL" } },
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
}): Promise<RestoreResult> {
  const admin = await requireSuperadmin();
  if (!isEmailTemplateKey(input.key)) return { error: "Onbekende template" };
  const def = EMAIL_TEMPLATE_DEFS[input.key];
  await ensureTemplate(input.key);

  await prisma.emailTemplate.update({
    where: { key_locale: { key: input.key, locale: "NL" } },
    data: {
      subject: def.defaultSubject,
      preheader: def.defaultPreheader,
      bodyHtml: def.defaultBodyHtml,
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
      subject: def.defaultSubject,
      preheader: def.defaultPreheader,
      bodyHtml: def.defaultBodyHtml,
    },
  };
}

const testSchema = contentSchema.extend({
  to: z.string().trim().email("Ongeldig e-mailadres"),
  tenantId: z.string().nullable(),
});

export type TestResult = { ok?: true; error?: string };

/** Verstuur een testmail (concept-inhoud + testgegevens) naar een eigen adres. */
export async function sendTestEmail(input: {
  key: string;
  subject: string;
  preheader: string;
  bodyHtml: string;
  to: string;
  tenantId: string | null;
}): Promise<TestResult> {
  const admin = await requireSuperadmin();
  const parsed = testSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ongeldige invoer" };
  }
  const { key, subject, preheader, bodyHtml, to, tenantId } = parsed.data;
  const def = EMAIL_TEMPLATE_DEFS[key];
  const branding = await loadTenantBranding(tenantId);

  const message = renderTemplateMessage({
    def,
    subject: `[TEST] ${subject}`,
    preheader,
    bodyHtml,
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
