/**
 * Validatie voor e-mailtemplates. Pure functies (geen server-only) zodat de
 * editor ze live kan gebruiken én de publish-action ze server-side afdwingt.
 *
 *  - errors  → blokkeren publiceren (onbekende placeholder, leeg subject/body).
 *  - warnings → informatief (ontbrekende verplichte placeholder, ongebalanceerde
 *               accolades, mogelijk losse <tag>).
 */
import {
  allowedTokens,
  EMAIL_TEMPLATE_DEFS,
  type EmailTemplateKey,
} from "@/lib/email/template-defaults";

export type ValidationResult = {
  errors: string[];
  warnings: string[];
};

/** Alle `{{token}}`-namen die in de tekst voorkomen. */
export function extractTokens(text: string): string[] {
  const out: string[] = [];
  const re = /\{\{\s*([\w.]+)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) out.push(m[1]);
  return out;
}

export function validateTemplate(opts: {
  key: EmailTemplateKey;
  subject: string;
  bodyHtml: string;
}): ValidationResult {
  const { key, subject, bodyHtml } = opts;
  const errors: string[] = [];
  const warnings: string[] = [];

  const def = EMAIL_TEMPLATE_DEFS[key];
  const allowed = allowedTokens(key);

  if (!subject.trim()) errors.push("Het onderwerp mag niet leeg zijn.");
  if (!bodyHtml.trim()) errors.push("De inhoud mag niet leeg zijn.");

  // Onbekende placeholders → hard error.
  const combined = `${subject}\n${bodyHtml}`;
  const used = new Set(extractTokens(combined));
  for (const token of used) {
    if (!allowed.has(token)) {
      errors.push(`Onbekende placeholder: {{${token}}}.`);
    }
  }

  // Ontbrekende verplichte placeholders → waarschuwing.
  for (const p of def.placeholders) {
    if (p.required && !used.has(p.token)) {
      warnings.push(
        `Verplichte placeholder {{${p.token}}} (${p.label}) ontbreekt — de mail mist mogelijk een belangrijke link.`
      );
    }
  }

  // Losse/ongebalanceerde accolades (typfout zoals {firstName} of {{firstName}).
  const openCount = (bodyHtml.match(/\{\{/g) ?? []).length;
  const closeCount = (bodyHtml.match(/\}\}/g) ?? []).length;
  if (openCount !== closeCount) {
    warnings.push(
      "Ongebalanceerde accolades — controleer of elke {{placeholder}} netjes geopend en gesloten is."
    );
  }

  return { errors, warnings };
}
