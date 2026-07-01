import "server-only";
import type { EmailBranding } from "@/lib/email/branding";
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
import { composeFromTemplate } from "@/lib/email/template-render";

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

/** Vriendelijke aanhef ("Hoi Jan," / "Hoi,"). */
function greeting(name: string | null | undefined): string {
  const first = name?.trim().split(/\s+/)[0];
  return first ? `Hoi ${first},` : "Hoi,";
}

/** Plain-text frame: aanhef-loze body + nette footer (reden + auto-bericht). */
function textFrame(branding: EmailBranding, body: string, reason: string): string {
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
    "Dit is een automatisch gegenereerd bericht — beantwoorden is niet nodig.",
    `© ${year} ${branding.name}`,
  ]
    .filter((line) => line !== null)
    .join("\n");
}

// ── Magic link (inloglink) ──────────────────────────────────────────────────

export async function magicLinkMessage(opts: {
  branding: EmailBranding;
  url: string;
}): Promise<EmailMessage> {
  const { branding, url } = opts;
  const fromDb = await composeFromTemplate({
    key: "magicLink",
    locale: branding.locale,
    branding,
    data: { loginLink: url },
  });
  if (fromDb) return fromDb;

  const reason = `Je ontvangt deze e-mail omdat er een inloglink is aangevraagd voor je account bij ${branding.name}.`;
  const contentHtml = [
    emailHeading(`Inloggen bij ${branding.name}`),
    emailParagraph(
      "Klik op de knop hieronder om veilig in te loggen. De link is eenmalig te gebruiken en verloopt na korte tijd."
    ),
    emailButton(url, "Inloggen", branding),
    emailLinkFallback(url),
    emailMuted(
      "Heb je geen inloglink aangevraagd? Dan kun je deze e-mail negeren — er gebeurt niets."
    ),
  ].join("");
  return {
    subject: `Je inloglink voor ${branding.name}`,
    html: renderEmailLayout({
      branding,
      preheader: "Je persoonlijke, eenmalige inloglink staat klaar.",
      contentHtml,
      reason,
    }),
    text: textFrame(
      branding,
      `Inloggen bij ${branding.name}\n\nGebruik deze eenmalige link om in te loggen (verloopt na korte tijd):\n${url}\n\nGeen inloglink aangevraagd? Negeer deze e-mail.`,
      reason
    ),
  };
}

// ── Uitnodiging ─────────────────────────────────────────────────────────────

export async function inviteMessage(opts: {
  branding: EmailBranding;
  acceptUrl: string;
}): Promise<EmailMessage> {
  const { branding, acceptUrl } = opts;
  const fromDb = await composeFromTemplate({
    key: "invite",
    locale: branding.locale,
    branding,
    data: { activationLink: acceptUrl },
  });
  if (fromDb) return fromDb;

  const reason = `Je ontvangt deze e-mail omdat ${branding.name} je heeft uitgenodigd voor een account.`;
  const contentHtml = [
    emailHeading(`Uitnodiging voor ${branding.name}`),
    emailParagraph(
      `Je bent uitgenodigd om een account te activeren bij <strong>${escapeHtml(
        branding.name
      )}</strong>. Accepteer de uitnodiging om aan de slag te gaan met je trainingsschema's.`
    ),
    emailButton(acceptUrl, "Uitnodiging accepteren", branding),
    emailLinkFallback(acceptUrl),
    emailMuted(
      "Deze uitnodiging is 7 dagen geldig. Verwachtte je deze e-mail niet? Dan kun je 'm negeren."
    ),
  ].join("");
  return {
    subject: `Uitnodiging voor ${branding.name}`,
    html: renderEmailLayout({
      branding,
      preheader: `Activeer je account bij ${branding.name}.`,
      contentHtml,
      reason,
    }),
    text: textFrame(
      branding,
      `Uitnodiging voor ${branding.name}\n\nJe bent uitgenodigd om een account te activeren bij ${branding.name}.\nAccepteer je uitnodiging (7 dagen geldig):\n${acceptUrl}`,
      reason
    ),
  };
}

// ── E-mailadres wijzigen ────────────────────────────────────────────────────

export async function emailChangeMessage(opts: {
  branding: EmailBranding;
  url: string;
  newEmail: string;
}): Promise<EmailMessage> {
  const { branding, url, newEmail } = opts;
  const fromDb = await composeFromTemplate({
    key: "emailChange",
    locale: branding.locale,
    branding,
    data: { confirmLink: url, newEmail },
  });
  if (fromDb) return fromDb;

  const reason = `Je ontvangt deze e-mail omdat er is gevraagd om het e-mailadres van je ${branding.name}-account te wijzigen.`;
  const contentHtml = [
    emailHeading("Bevestig je nieuwe e-mailadres"),
    emailParagraph(
      `Klik om je e-mailadres voor <strong>${escapeHtml(
        branding.name
      )}</strong> te wijzigen naar <strong>${escapeHtml(newEmail)}</strong>.`
    ),
    emailButton(url, "E-mailadres bevestigen", branding),
    emailLinkFallback(url),
    emailMuted(
      "Heb je dit niet aangevraagd? Negeer deze e-mail; je e-mailadres blijft dan ongewijzigd."
    ),
  ].join("");
  return {
    subject: "Bevestig je nieuwe e-mailadres",
    html: renderEmailLayout({
      branding,
      preheader: `Bevestig de wijziging naar ${newEmail}.`,
      contentHtml,
      reason,
    }),
    text: textFrame(
      branding,
      `Bevestig je nieuwe e-mailadres\n\nBevestig de wijziging naar ${newEmail}:\n${url}\n\nNiet aangevraagd? Negeer deze e-mail.`,
      reason
    ),
  };
}

// ── Welkom / account geactiveerd ────────────────────────────────────────────

export async function welcomeMessage(opts: {
  branding: EmailBranding;
  recipientName?: string | null;
  loginUrl: string;
}): Promise<EmailMessage> {
  const { branding, recipientName, loginUrl } = opts;
  const fromDb = await composeFromTemplate({
    key: "welcome",
    locale: branding.locale,
    branding,
    data: { firstName: firstNameOf(recipientName), loginLink: loginUrl },
  });
  if (fromDb) return fromDb;

  const reason = `Je ontvangt deze e-mail omdat je account bij ${branding.name} zojuist is geactiveerd.`;
  const contentHtml = [
    emailHeading(`Welkom bij ${branding.name}!`),
    emailParagraph(`${escapeHtml(greeting(recipientName))}`),
    emailParagraph(
      "Je account is geactiveerd. Log in om je trainingsschema's te bekijken, je voortgang bij te houden en aan de slag te gaan."
    ),
    emailButton(loginUrl, "Inloggen", branding),
    emailLinkFallback(loginUrl),
  ].join("");
  return {
    subject: `Welkom bij ${branding.name}`,
    html: renderEmailLayout({
      branding,
      preheader: "Je account is geactiveerd — log in om te beginnen.",
      contentHtml,
      reason,
    }),
    text: textFrame(
      branding,
      `Welkom bij ${branding.name}!\n\n${greeting(
        recipientName
      )}\n\nJe account is geactiveerd. Log in om te beginnen:\n${loginUrl}`,
      reason
    ),
  };
}

// ── Wachtwoord gewijzigd (beveiligingsmelding) ──────────────────────────────

export async function passwordChangedMessage(opts: {
  branding: EmailBranding;
  recipientName?: string | null;
  securityUrl: string;
}): Promise<EmailMessage> {
  const { branding, recipientName, securityUrl } = opts;
  const fromDb = await composeFromTemplate({
    key: "passwordChanged",
    locale: branding.locale,
    branding,
    data: { firstName: firstNameOf(recipientName), securityLink: securityUrl },
  });
  if (fromDb) return fromDb;

  const reason = `Je ontvangt deze e-mail omdat het wachtwoord van je ${branding.name}-account is gewijzigd.`;
  const contentHtml = [
    emailHeading("Je wachtwoord is gewijzigd"),
    emailParagraph(`${escapeHtml(greeting(recipientName))}`),
    emailParagraph(
      `Het wachtwoord van je account bij <strong>${escapeHtml(
        branding.name
      )}</strong> is zojuist aangepast. Was jij dit? Dan hoef je niets te doen.`
    ),
    emailParagraph(
      "Heb jij dit <strong>niet</strong> gedaan? Beveilig dan direct je account."
    ),
    emailButton(securityUrl, "Beveiliging bekijken", branding),
    emailLinkFallback(securityUrl),
  ].join("");
  return {
    subject: `Je wachtwoord bij ${branding.name} is gewijzigd`,
    html: renderEmailLayout({
      branding,
      preheader: "Een beveiligingsmelding over je account.",
      contentHtml,
      reason,
    }),
    text: textFrame(
      branding,
      `Je wachtwoord is gewijzigd\n\n${greeting(
        recipientName
      )}\n\nHet wachtwoord van je ${branding.name}-account is zojuist aangepast. Was jij dit niet? Beveilig direct je account:\n${securityUrl}`,
      reason
    ),
  };
}

// ── Nieuw trainingsschema toegewezen ────────────────────────────────────────

export async function schemaAssignedMessage(opts: {
  branding: EmailBranding;
  recipientName?: string | null;
  schemaName: string;
  viewUrl: string;
}): Promise<EmailMessage> {
  const { branding, recipientName, schemaName, viewUrl } = opts;
  const fromDb = await composeFromTemplate({
    key: "schemaAssigned",
    locale: branding.locale,
    branding,
    data: {
      firstName: firstNameOf(recipientName),
      workoutName: schemaName,
      schemaLink: viewUrl,
    },
  });
  if (fromDb) return fromDb;

  const reason = `Je ontvangt deze e-mail omdat ${branding.name} een trainingsschema aan je heeft toegewezen.`;
  const contentHtml = [
    emailHeading("Je hebt een nieuw trainingsschema"),
    emailParagraph(`${escapeHtml(greeting(recipientName))}`),
    emailParagraph(
      `<strong>${escapeHtml(
        branding.name
      )}</strong> heeft een nieuw trainingsschema voor je klaargezet: <strong>${escapeHtml(
        schemaName
      )}</strong>. Bekijk je oefeningen en begin je volgende training.`
    ),
    emailButton(viewUrl, "Bekijk je schema", branding),
    emailLinkFallback(viewUrl),
  ].join("");
  return {
    subject: `Nieuw trainingsschema: ${schemaName}`,
    html: renderEmailLayout({
      branding,
      preheader: `${schemaName} staat voor je klaar.`,
      contentHtml,
      reason,
    }),
    text: textFrame(
      branding,
      `Je hebt een nieuw trainingsschema\n\n${greeting(
        recipientName
      )}\n\n${branding.name} heeft "${schemaName}" voor je klaargezet. Bekijk je schema:\n${viewUrl}`,
      reason
    ),
  };
}

// ── Schema-aanvraag ontvangen (naar de coach/owner) ─────────────────────────

export async function schemaRequestReceivedMessage(opts: {
  branding: EmailBranding;
  recipientName?: string | null;
  memberName: string;
  goalLabel: string;
  description?: string | null;
  manageUrl: string;
}): Promise<EmailMessage> {
  const { branding, recipientName, memberName, goalLabel, description, manageUrl } = opts;
  const reason = `Je ontvangt deze e-mail omdat een lid van ${branding.name} een trainingsschema heeft aangevraagd.`;
  const contentHtml = [
    emailHeading("Nieuwe schema-aanvraag"),
    emailParagraph(`${escapeHtml(greeting(recipientName))}`),
    emailParagraph(
      `<strong>${escapeHtml(memberName)}</strong> heeft een nieuw trainingsschema aangevraagd. Doel: <strong>${escapeHtml(goalLabel)}</strong>.`
    ),
    description?.trim() ? emailParagraph(`"${escapeHtml(description.trim())}"`) : "",
    emailButton(manageUrl, "Aanvraag bekijken", branding),
    emailLinkFallback(manageUrl),
  ].join("");
  return {
    subject: `Schema-aanvraag van ${memberName}`,
    html: renderEmailLayout({
      branding,
      preheader: `${memberName} vraagt een trainingsschema aan (${goalLabel}).`,
      contentHtml,
      reason,
    }),
    text: textFrame(
      branding,
      `Nieuwe schema-aanvraag\n\n${greeting(recipientName)}\n\n${memberName} heeft een nieuw trainingsschema aangevraagd. Doel: ${goalLabel}.${
        description?.trim() ? `\n\n"${description.trim()}"` : ""
      }\n\nBekijk de aanvraag:\n${manageUrl}`,
      reason
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
}): Promise<EmailMessage> {
  const { branding, recipientName, memberName, schemaName, reviewUrl } = opts;
  const reason = `Je ontvangt deze e-mail omdat een lid van ${branding.name} zelf een trainingsschema heeft ingediend ter controle.`;
  const contentHtml = [
    emailHeading("Schema ter controle"),
    emailParagraph(`${escapeHtml(greeting(recipientName))}`),
    emailParagraph(
      `<strong>${escapeHtml(memberName)}</strong> heeft zelf een trainingsschema samengesteld en ingediend ter controle: <strong>${escapeHtml(
        schemaName
      )}</strong>. Bekijk het, pas het eventueel aan en keur het goed of af.`
    ),
    emailButton(reviewUrl, "Schema bekijken", branding),
    emailLinkFallback(reviewUrl),
  ].join("");
  return {
    subject: `Schema ter controle van ${memberName}`,
    html: renderEmailLayout({
      branding,
      preheader: `${memberName} diende '${schemaName}' in ter controle.`,
      contentHtml,
      reason,
    }),
    text: textFrame(
      branding,
      `Schema ter controle\n\n${greeting(recipientName)}\n\n${memberName} heeft zelf "${schemaName}" ingediend ter controle.\n\nBekijk het schema:\n${reviewUrl}`,
      reason
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
}): Promise<EmailMessage> {
  const { branding, recipientName, schemaName, approved, reviewNote, viewUrl } = opts;
  const reason = `Je ontvangt deze e-mail omdat je coach bij ${branding.name} je zelf-gebouwde schema heeft beoordeeld.`;
  const heading = approved ? "Je schema is goedgekeurd" : "Je schema vraagt aanpassingen";
  const contentHtml = [
    emailHeading(heading),
    emailParagraph(`${escapeHtml(greeting(recipientName))}`),
    emailParagraph(
      approved
        ? `Je zelf-gebouwde schema <strong>${escapeHtml(
            schemaName
          )}</strong> is goedgekeurd. Activeer het om ermee te gaan trainen.`
        : `Je coach vraagt om aanpassingen aan je schema <strong>${escapeHtml(
            schemaName
          )}</strong>.`
    ),
    reviewNote?.trim() ? emailParagraph(`"${escapeHtml(reviewNote.trim())}"`) : "",
    emailButton(viewUrl, approved ? "Schema activeren" : "Schema aanpassen", branding),
    emailLinkFallback(viewUrl),
  ].join("");
  return {
    subject: approved
      ? `Goedgekeurd: ${schemaName}`
      : `Aanpassingen gevraagd: ${schemaName}`,
    html: renderEmailLayout({
      branding,
      preheader: approved
        ? `${schemaName} is goedgekeurd.`
        : `${schemaName} vraagt om aanpassingen.`,
      contentHtml,
      reason,
    }),
    text: textFrame(
      branding,
      `${heading}\n\n${greeting(recipientName)}\n\n${
        approved
          ? `Je schema "${schemaName}" is goedgekeurd. Activeer het om te trainen.`
          : `Je coach vraagt om aanpassingen aan "${schemaName}".`
      }${reviewNote?.trim() ? `\n\n"${reviewNote.trim()}"` : ""}\n\n${viewUrl}`,
      reason
    ),
  };
}

// ── Status schema-aanvraag gewijzigd (naar de sporter) ──────────────────────

export async function schemaRequestStatusMessage(opts: {
  branding: EmailBranding;
  recipientName?: string | null;
  statusLabel: string;
  viewUrl: string;
}): Promise<EmailMessage> {
  const { branding, recipientName, statusLabel, viewUrl } = opts;
  const reason = `Je ontvangt deze e-mail omdat de status van je schema-aanvraag bij ${branding.name} is gewijzigd.`;
  const contentHtml = [
    emailHeading("Update over je schema-aanvraag"),
    emailParagraph(`${escapeHtml(greeting(recipientName))}`),
    emailParagraph(
      `De status van je trainingsschema-aanvraag is nu: <strong>${escapeHtml(statusLabel)}</strong>.`
    ),
    emailButton(viewUrl, "Bekijk je aanvraag", branding),
    emailLinkFallback(viewUrl),
  ].join("");
  return {
    subject: `Je schema-aanvraag: ${statusLabel}`,
    html: renderEmailLayout({
      branding,
      preheader: `Nieuwe status: ${statusLabel}.`,
      contentHtml,
      reason,
    }),
    text: textFrame(
      branding,
      `Update over je schema-aanvraag\n\n${greeting(recipientName)}\n\nDe status van je aanvraag is nu: ${statusLabel}.\n\nBekijk je aanvraag:\n${viewUrl}`,
      reason
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
}): Promise<EmailMessage> {
  const { branding, recipientName, title, description, rarityLabel, viewUrl } = opts;
  const reason = `Je ontvangt deze e-mail omdat je een nieuwe trofee hebt behaald bij ${branding.name}.`;
  const contentHtml = [
    emailHeading("🏆 Nieuwe trofee behaald!"),
    emailParagraph(`${escapeHtml(greeting(recipientName))}`),
    emailParagraph(
      `Gefeliciteerd! Je hebt de trofee <strong>${escapeHtml(
        title
      )}</strong> (${escapeHtml(rarityLabel)}) behaald.`
    ),
    emailInfoCard(
      `<p style="margin:0;font-size:15px;color:#1f2937"><strong>${escapeHtml(
        title
      )}</strong></p><p style="margin:6px 0 0;font-size:14px;color:#6b7280">${escapeHtml(
        description
      )}</p>`
    ),
    emailButton(viewUrl, "Bekijk je trofeeën", branding),
    emailLinkFallback(viewUrl),
  ].join("");
  return {
    subject: `🏆 Trofee behaald: ${title}`,
    html: renderEmailLayout({
      branding,
      preheader: `Je hebt "${title}" behaald — goed bezig!`,
      contentHtml,
      reason,
    }),
    text: textFrame(
      branding,
      `Nieuwe trofee behaald!\n\n${greeting(
        recipientName
      )}\n\nGefeliciteerd! Je hebt de trofee "${title}" (${rarityLabel}) behaald.\n${description}\n\nBekijk je trofeeën:\n${viewUrl}`,
      reason
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
      reason
    ),
  };
}
