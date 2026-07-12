import "server-only";
import type { Locale } from "@prisma/client";
import { getTranslations } from "next-intl/server";
import type { EmailBranding } from "@/lib/email/branding";
import { localeFromEnum } from "@/lib/i18n/config";
import { renderEmailLayout } from "@/lib/email/layout";
import {
  emailButton,
  emailHeading,
  emailInfoCard,
  emailLinkFallback,
  emailMuted,
  emailParagraph,
  escapeHtml,
} from "@/lib/email/components";
import { composeFromTemplate, EMAIL_FOOTER_AUTO } from "@/lib/email/template-render";

/** Namespaced e-mail-translator (voor de code-composers, in de ontvangertaal). */
type EmailT = Awaited<ReturnType<typeof getTranslations>>;

/** `<strong>`-gewrapte, veilig-ge-escapete waarde voor in een body-placeholder. */
function strong(value: string): string {
  return `<strong>${escapeHtml(value)}</strong>`;
}

/** Eerste woord van een naam (voor de {{firstName}}-placeholder). "" indien leeg. */
function firstNameOf(name: string | null | undefined): string {
  return name?.trim().split(/\s+/)[0] ?? "";
}

/**
 * E-mail-composers. Elke functie levert een volledige `EmailMessage`
 * (`subject` + `html` + plain-text `text`). Nieuw e-mailtype = één composer
 * toevoegen; layout, huisstijl en verzending blijven gedeeld.
 */
export type EmailMessage = {
  subject: string;
  html: string;
  text: string;
};

/** Vriendelijke aanhef in de ontvangertaal ("Hoi Jan," / "Hi Jan," / …). */
function greetingText(t: EmailT, name: string | null | undefined): string {
  const first = name?.trim().split(/\s+/)[0];
  return first ? t("greeting", { name: first }) : t("greetingAnon");
}

/** Plain-text frame: aanhef-loze body + nette footer (reden + auto-bericht). */
function textFrame(
  branding: EmailBranding,
  body: string,
  reason: string,
  footerNote: string
): string {
  const year = new Date().getFullYear();
  const contact = [
    branding.address,
    branding.contactPhone,
    branding.contactEmail,
    branding.website,
  ]
    .filter(Boolean)
    .join(" · ");
  return [
    body.trim(),
    "",
    "—",
    branding.name,
    contact || null,
    reason,
    footerNote,
    `© ${year} ${branding.name}`,
  ]
    .filter((line) => line !== null)
    .join("\n");
}

// ── Magic link (inloglink) ──────────────────────────────────────────────────

export async function magicLinkMessage(opts: {
  branding: EmailBranding;
  url: string;
  locale?: Locale | null;
}): Promise<EmailMessage> {
  const { branding, url } = opts;
  return composeFromTemplate({
    key: "magicLink",
    locale: opts.locale ?? branding.locale,
    branding,
    data: { loginLink: url },
  });
}

// ── Uitnodiging ─────────────────────────────────────────────────────────────

export async function inviteMessage(opts: {
  branding: EmailBranding;
  acceptUrl: string;
  locale?: Locale | null;
}): Promise<EmailMessage> {
  const { branding, acceptUrl } = opts;
  return composeFromTemplate({
    key: "invite",
    locale: opts.locale ?? branding.locale,
    branding,
    data: { activationLink: acceptUrl },
  });
}

// ── E-mailadres wijzigen ────────────────────────────────────────────────────

export async function emailChangeMessage(opts: {
  branding: EmailBranding;
  url: string;
  newEmail: string;
  locale?: Locale | null;
}): Promise<EmailMessage> {
  const { branding, url, newEmail } = opts;
  return composeFromTemplate({
    key: "emailChange",
    locale: opts.locale ?? branding.locale,
    branding,
    data: { confirmLink: url, newEmail },
  });
}

// ── Welkom / account geactiveerd ────────────────────────────────────────────

export async function welcomeMessage(opts: {
  branding: EmailBranding;
  recipientName?: string | null;
  loginUrl: string;
  locale?: Locale | null;
}): Promise<EmailMessage> {
  const { branding, recipientName, loginUrl } = opts;
  return composeFromTemplate({
    key: "welcome",
    locale: opts.locale ?? branding.locale,
    branding,
    data: { firstName: firstNameOf(recipientName), loginLink: loginUrl },
  });
}

// ── Wachtwoord vergeten (reset-link) ────────────────────────────────────────

export async function passwordResetMessage(opts: {
  branding: EmailBranding;
  recipientName?: string | null;
  resetUrl: string;
  locale?: Locale | null;
}): Promise<EmailMessage> {
  const { branding, recipientName, resetUrl } = opts;
  return composeFromTemplate({
    key: "passwordReset",
    locale: opts.locale ?? branding.locale,
    branding,
    data: { firstName: firstNameOf(recipientName), resetLink: resetUrl },
  });
}

// ── Wachtwoord gewijzigd (beveiligingsmelding) ──────────────────────────────

export async function passwordChangedMessage(opts: {
  branding: EmailBranding;
  recipientName?: string | null;
  securityUrl: string;
  locale?: Locale | null;
}): Promise<EmailMessage> {
  const { branding, recipientName, securityUrl } = opts;
  return composeFromTemplate({
    key: "passwordChanged",
    locale: opts.locale ?? branding.locale,
    branding,
    data: { firstName: firstNameOf(recipientName), securityLink: securityUrl },
  });
}

// ── Nieuw trainingsschema toegewezen ────────────────────────────────────────

export async function schemaAssignedMessage(opts: {
  branding: EmailBranding;
  recipientName?: string | null;
  schemaName: string;
  viewUrl: string;
  locale?: Locale | null;
}): Promise<EmailMessage> {
  const { branding, recipientName, schemaName, viewUrl } = opts;
  return composeFromTemplate({
    key: "schemaAssigned",
    locale: opts.locale ?? branding.locale,
    branding,
    data: {
      firstName: firstNameOf(recipientName),
      workoutName: schemaName,
      schemaLink: viewUrl,
    },
  });
}

// ── Schema-aanvraag ontvangen (naar de coach/owner) ─────────────────────────

export async function schemaRequestReceivedMessage(opts: {
  branding: EmailBranding;
  recipientName?: string | null;
  memberName: string;
  goalLabel: string;
  description?: string | null;
  manageUrl: string;
  locale?: Locale | null;
}): Promise<EmailMessage> {
  const { branding, recipientName, memberName, goalLabel, description, manageUrl } = opts;
  const loc = opts.locale ?? branding.locale;
  const t = await getTranslations({ locale: localeFromEnum(loc), namespace: "email" });
  const footerNote = EMAIL_FOOTER_AUTO[loc] ?? EMAIL_FOOTER_AUTO.NL;
  const reason = t("schemaRequestReceived.reason", { gym: branding.name });
  const g = greetingText(t, recipientName);
  const noteBlock = description?.trim() ? `\n\n"${description.trim()}"` : "";
  const contentHtml = [
    emailHeading(t("schemaRequestReceived.heading")),
    emailParagraph(escapeHtml(g)),
    emailParagraph(t("schemaRequestReceived.body", { member: strong(memberName), goal: strong(goalLabel) })),
    description?.trim() ? emailParagraph(`"${escapeHtml(description.trim())}"`) : "",
    emailButton(manageUrl, t("schemaRequestReceived.btn"), branding),
    emailLinkFallback(manageUrl),
  ].join("");
  return {
    subject: t("schemaRequestReceived.subject", { member: memberName }),
    html: renderEmailLayout({
      branding,
      preheader: t("schemaRequestReceived.preheader", { member: memberName, goal: goalLabel }),
      contentHtml,
      reason,
      footerNote,
    }),
    text: textFrame(
      branding,
      `${t("schemaRequestReceived.heading")}\n\n${g}\n\n${t("schemaRequestReceived.body", {
        member: memberName,
        goal: goalLabel,
      })}${noteBlock}\n\n${manageUrl}`,
      reason,
      footerNote
    ),
  };
}

// ── Zelf-gebouwd schema ingediend (naar de coach/owner) ─────────────────────

export async function memberSchemaSubmittedMessage(opts: {
  branding: EmailBranding;
  recipientName?: string | null;
  memberName: string;
  schemaName: string;
  reviewUrl: string;
  locale?: Locale | null;
}): Promise<EmailMessage> {
  const { branding, recipientName, memberName, schemaName, reviewUrl } = opts;
  const loc = opts.locale ?? branding.locale;
  const t = await getTranslations({ locale: localeFromEnum(loc), namespace: "email" });
  const footerNote = EMAIL_FOOTER_AUTO[loc] ?? EMAIL_FOOTER_AUTO.NL;
  const reason = t("memberSchemaSubmitted.reason", { gym: branding.name });
  const g = greetingText(t, recipientName);
  const contentHtml = [
    emailHeading(t("memberSchemaSubmitted.heading")),
    emailParagraph(escapeHtml(g)),
    emailParagraph(t("memberSchemaSubmitted.body", { member: strong(memberName), schema: strong(schemaName) })),
    emailButton(reviewUrl, t("memberSchemaSubmitted.btn"), branding),
    emailLinkFallback(reviewUrl),
  ].join("");
  return {
    subject: t("memberSchemaSubmitted.subject", { member: memberName }),
    html: renderEmailLayout({
      branding,
      preheader: t("memberSchemaSubmitted.preheader", { member: memberName, schema: schemaName }),
      contentHtml,
      reason,
      footerNote,
    }),
    text: textFrame(
      branding,
      `${t("memberSchemaSubmitted.heading")}\n\n${g}\n\n${t("memberSchemaSubmitted.body", {
        member: memberName,
        schema: schemaName,
      })}\n\n${reviewUrl}`,
      reason,
      footerNote
    ),
  };
}

// ── Zelf-gebouwd schema beoordeeld (naar de sporter) ────────────────────────

export async function memberSchemaReviewedMessage(opts: {
  branding: EmailBranding;
  recipientName?: string | null;
  schemaName: string;
  approved: boolean;
  reviewNote?: string | null;
  viewUrl: string;
  locale?: Locale | null;
}): Promise<EmailMessage> {
  const { branding, recipientName, schemaName, approved, reviewNote, viewUrl } = opts;
  const loc = opts.locale ?? branding.locale;
  const t = await getTranslations({ locale: localeFromEnum(loc), namespace: "email" });
  const footerNote = EMAIL_FOOTER_AUTO[loc] ?? EMAIL_FOOTER_AUTO.NL;
  const reason = t("memberSchemaReviewed.reason", { gym: branding.name });
  const g = greetingText(t, recipientName);
  const heading = approved
    ? t("memberSchemaReviewed.headingApproved")
    : t("memberSchemaReviewed.headingRejected");
  const bodyHtml = approved
    ? t("memberSchemaReviewed.bodyApproved", { schema: strong(schemaName) })
    : t("memberSchemaReviewed.bodyRejected", { schema: strong(schemaName) });
  const bodyPlain = approved
    ? t("memberSchemaReviewed.bodyApproved", { schema: schemaName })
    : t("memberSchemaReviewed.bodyRejected", { schema: schemaName });
  const contentHtml = [
    emailHeading(heading),
    emailParagraph(escapeHtml(g)),
    emailParagraph(bodyHtml),
    reviewNote?.trim() ? emailParagraph(`"${escapeHtml(reviewNote.trim())}"`) : "",
    emailButton(
      viewUrl,
      approved ? t("memberSchemaReviewed.btnApproved") : t("memberSchemaReviewed.btnRejected"),
      branding
    ),
    emailLinkFallback(viewUrl),
  ].join("");
  return {
    subject: approved
      ? t("memberSchemaReviewed.subjectApproved", { schema: schemaName })
      : t("memberSchemaReviewed.subjectRejected", { schema: schemaName }),
    html: renderEmailLayout({
      branding,
      preheader: approved
        ? t("memberSchemaReviewed.preheaderApproved", { schema: schemaName })
        : t("memberSchemaReviewed.preheaderRejected", { schema: schemaName }),
      contentHtml,
      reason,
      footerNote,
    }),
    text: textFrame(
      branding,
      `${heading}\n\n${g}\n\n${bodyPlain}${
        reviewNote?.trim() ? `\n\n"${reviewNote.trim()}"` : ""
      }\n\n${viewUrl}`,
      reason,
      footerNote
    ),
  };
}

// ── Status schema-aanvraag gewijzigd (naar de sporter) ──────────────────────

export async function schemaRequestStatusMessage(opts: {
  branding: EmailBranding;
  recipientName?: string | null;
  statusLabel: string;
  viewUrl: string;
  locale?: Locale | null;
}): Promise<EmailMessage> {
  const { branding, recipientName, statusLabel, viewUrl } = opts;
  const loc = opts.locale ?? branding.locale;
  const t = await getTranslations({ locale: localeFromEnum(loc), namespace: "email" });
  const footerNote = EMAIL_FOOTER_AUTO[loc] ?? EMAIL_FOOTER_AUTO.NL;
  const reason = t("schemaRequestStatus.reason", { gym: branding.name });
  const g = greetingText(t, recipientName);
  const contentHtml = [
    emailHeading(t("schemaRequestStatus.heading")),
    emailParagraph(escapeHtml(g)),
    emailParagraph(t("schemaRequestStatus.body", { status: strong(statusLabel) })),
    emailButton(viewUrl, t("schemaRequestStatus.btn"), branding),
    emailLinkFallback(viewUrl),
  ].join("");
  return {
    subject: t("schemaRequestStatus.subject", { status: statusLabel }),
    html: renderEmailLayout({
      branding,
      preheader: t("schemaRequestStatus.preheader", { status: statusLabel }),
      contentHtml,
      reason,
      footerNote,
    }),
    text: textFrame(
      branding,
      `${t("schemaRequestStatus.heading")}\n\n${g}\n\n${t("schemaRequestStatus.body", {
        status: statusLabel,
      })}\n\n${viewUrl}`,
      reason,
      footerNote
    ),
  };
}

// ── Achievement/trofee behaald (naar de sporter) ────────────────────────────

export async function achievementEarnedMessage(opts: {
  branding: EmailBranding;
  recipientName?: string | null;
  title: string;
  description: string;
  rarityLabel: string;
  viewUrl: string;
  locale?: Locale | null;
}): Promise<EmailMessage> {
  const { branding, recipientName, title, description, rarityLabel, viewUrl } = opts;
  const loc = opts.locale ?? branding.locale;
  const t = await getTranslations({ locale: localeFromEnum(loc), namespace: "email" });
  const footerNote = EMAIL_FOOTER_AUTO[loc] ?? EMAIL_FOOTER_AUTO.NL;
  const reason = t("achievementEarned.reason", { gym: branding.name });
  const g = greetingText(t, recipientName);
  const contentHtml = [
    emailHeading(t("achievementEarned.heading")),
    emailParagraph(escapeHtml(g)),
    emailParagraph(t("achievementEarned.body", { title: strong(title), rarity: escapeHtml(rarityLabel) })),
    emailInfoCard(
      `<p style="margin:0;font-size:15px;color:#1f2937"><strong>${escapeHtml(
        title
      )}</strong></p><p style="margin:6px 0 0;font-size:14px;color:#6b7280">${escapeHtml(
        description
      )}</p>`
    ),
    emailButton(viewUrl, t("achievementEarned.btn"), branding),
    emailLinkFallback(viewUrl),
  ].join("");
  return {
    subject: t("achievementEarned.subject", { title }),
    html: renderEmailLayout({
      branding,
      preheader: t("achievementEarned.preheader", { title }),
      contentHtml,
      reason,
      footerNote,
    }),
    text: textFrame(
      branding,
      `${t("achievementEarned.heading")}\n\n${g}\n\n${t("achievementEarned.body", {
        title,
        rarity: rarityLabel,
      })}\n${description}\n\n${viewUrl}`,
      reason,
      footerNote
    ),
  };
}

// ── Machine-onderhoud (naar beheerder/medewerker met maintenance:manage) ─────

export async function maintenanceAlertMessage(opts: {
  branding: EmailBranding;
  recipientName?: string | null;
  machineName: string;
  headline: string;
  intro: string;
  detail?: string | null;
  manageUrl: string;
  locale?: Locale | null;
}): Promise<EmailMessage> {
  const { branding, recipientName, machineName, headline, intro, detail, manageUrl } = opts;
  const loc = opts.locale ?? branding.locale;
  const t = await getTranslations({ locale: localeFromEnum(loc), namespace: "email" });
  const footerNote = EMAIL_FOOTER_AUTO[loc] ?? EMAIL_FOOTER_AUTO.NL;
  const reason = t("maintenanceAlert.reason", { gym: branding.name });
  const g = greetingText(t, recipientName);
  const contentHtml = [
    emailHeading(headline),
    emailParagraph(escapeHtml(g)),
    emailParagraph(intro),
    detail?.trim() ? emailInfoCard(`<p style="margin:0;font-size:14px;color:#1f2937">${escapeHtml(detail.trim())}</p>`) : "",
    emailButton(manageUrl, t("maintenanceAlert.btn"), branding),
    emailLinkFallback(manageUrl),
  ].join("");
  return {
    subject: `${headline}: ${machineName}`,
    html: renderEmailLayout({
      branding,
      preheader: `${machineName} — ${headline.toLowerCase()}.`,
      contentHtml,
      reason,
      footerNote,
    }),
    text: textFrame(
      branding,
      `${headline}\n\n${g}\n\n${intro.replace(/<[^>]+>/g, "")}${
        detail?.trim() ? `\n\n${detail.trim()}` : ""
      }\n\n${manageUrl}`,
      reason,
      footerNote
    ),
  };
}

// ── Contactbericht van een sportschooleigenaar (naar platform-support) ───────

/**
 * Supportbericht dat een Tenant Owner via "Contact opnemen" indient. Gaat naar
 * het (configureerbare) support-adres. Gebrand met de GymRebel-default-branding
 * (platform-mail, niet tenant-specifiek). De afzendergegevens staan in een
 * info-card zodat support direct kan antwoorden; `replyTo` wordt door de caller
 * op het afzenderadres gezet.
 */
export async function supportRequestMessage(opts: {
  branding: EmailBranding;
  senderName: string;
  senderEmail: string;
  gymName: string;
  subject: string;
  categoryLabel: string;
  priorityLabel: string;
  message: string;
  submittedAt: Date;
}): Promise<EmailMessage> {
  const {
    branding,
    senderName,
    senderEmail,
    gymName,
    subject,
    categoryLabel,
    priorityLabel,
    message,
    submittedAt,
  } = opts;

  const when = new Intl.DateTimeFormat("nl-NL", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Europe/Amsterdam",
  }).format(submittedAt);

  const reason = `Je ontvangt deze e-mail omdat een sportschooleigenaar via het contactformulier van ${branding.name} een bericht heeft verstuurd.`;

  const row = (label: string, value: string) =>
    `<tr><td style="padding:2px 12px 2px 0;font-size:13px;color:#6b7280;white-space:nowrap;vertical-align:top">${escapeHtml(
      label
    )}</td><td style="padding:2px 0;font-size:14px;color:#1f2937">${escapeHtml(value)}</td></tr>`;

  const details = emailInfoCard(
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%">
      ${row("Afzender", senderName)}
      ${row("Sportschool", gymName)}
      ${row("E-mailadres", senderEmail)}
      ${row("Categorie", categoryLabel)}
      ${row("Prioriteit", priorityLabel)}
      ${row("Datum & tijd", when)}
    </table>`
  );

  // Bericht met behoud van regeleinden.
  const messageHtml = escapeHtml(message).replace(/\r?\n/g, "<br>");

  const contentHtml = [
    emailHeading("Nieuw supportbericht"),
    emailParagraph(
      `<strong>${escapeHtml(senderName)}</strong> van <strong>${escapeHtml(
        gymName
      )}</strong> heeft een bericht verstuurd via het contactformulier.`
    ),
    details,
    emailParagraph(`<strong>Onderwerp:</strong> ${escapeHtml(subject)}`),
    emailParagraph(messageHtml),
    emailButton(`mailto:${encodeURIComponent(senderEmail)}`, "Beantwoorden", branding),
    emailMuted(`Antwoord rechtstreeks aan ${escapeHtml(senderEmail)}.`),
  ].join("");

  return {
    subject: `[${priorityLabel}] Support · ${gymName}: ${subject}`,
    html: renderEmailLayout({
      branding,
      preheader: `${senderName} (${gymName}): ${subject}`,
      contentHtml,
      reason,
    }),
    text: textFrame(
      branding,
      [
        "Nieuw supportbericht",
        "",
        `Afzender:     ${senderName}`,
        `Sportschool:  ${gymName}`,
        `E-mailadres:  ${senderEmail}`,
        `Categorie:    ${categoryLabel}`,
        `Prioriteit:   ${priorityLabel}`,
        `Datum & tijd: ${when}`,
        "",
        `Onderwerp: ${subject}`,
        "",
        message,
        "",
        `Antwoord rechtstreeks aan ${senderEmail}.`,
      ].join("\n"),
      reason,
      EMAIL_FOOTER_AUTO.NL
    ),
  };
}
