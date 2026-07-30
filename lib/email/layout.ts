import "server-only";
import type { EmailBranding } from "@/lib/email/branding";
import { escapeHtml } from "@/lib/email/components";

/**
 * Centrale HTML-shell voor álle uitgaande e-mails. Table-based, 600px breed,
 * inline CSS op elk element (Outlook/Gmail), met een aanvullend <style>-blok
 * voor responsive (mobiel) en dark-mode waar de client dat ondersteunt.
 *
 * Eén plek = consistente uitstraling; nieuwe e-mailtypes leveren alleen
 * `contentHtml` aan (zie lib/email/messages.ts).
 */
export type LayoutInput = {
  branding: EmailBranding;
  /** Korte preview-tekst (preheader) die in de inbox-lijst verschijnt. */
  preheader: string;
  /** Inhoud van de kaart (opgebouwd met lib/email/components.ts). */
  contentHtml: string;
  /** "Je ontvangt deze e-mail omdat…" — transparantie in de footer. */
  reason: string;
  /** Gelokaliseerde "automatisch bericht"-regel. Default: NL. */
  footerNote?: string;
  /**
   * Kleurschema. `"auto"` (default, échte verzendingen) = licht, met de
   * dark-mode-regels achter een media-query. `"light"`/`"dark"` forceren één
   * weergave zonder media-query — gebruikt door de on-screen template-preview,
   * zodat die niet meekleurt met het OS van de beheerder én de dark-variant
   * daadwerkelijk te controleren is.
   */
  scheme?: "auto" | "light" | "dark";
};

/**
 * Dark-mode-regels. **Alles met `!important`**, want de e-mailinhoud draagt
 * inline kleuren (verplicht voor Outlook/Gmail) en die winnen anders van een
 * klasse-regel — precies de bug waardoor donkergrijze tekst op een donkere kaart
 * belandde (1,2:1). Een `!important`-declaratie uit het <style>-blok verslaat
 * wél een inline `style`, dus dit is de enige betrouwbare hefboom.
 *
 * De brede `.dm-card h1, … p, … td`-regel is bewust vangnet-gedrag: ook door de
 * Superadmin geschreven template-HTML (die onze klassen niet kent) wordt zo
 * leesbaar. `<a>` staat er bewust NIET bij — dat zou het knoplabel overschrijven
 * en daarmee `accentText` op een licht accent slopen.
 */
const DARK_RULES = `
  body,.dm-bg{background:#0b0f17!important}
  .dm-card{background:#111827!important}
  .dm-card h1,.dm-card h2,.dm-card h3,.dm-card p,.dm-card td,.dm-card span,.dm-card strong,.dm-card li,.dm-text{color:#e5e7eb!important}
  .dm-card .dm-muted,.dm-card .dm-muted a,.dm-muted{color:#9ca3af!important}
  .dm-panel{background:#1f2937!important;border-color:#374151!important}
  .dm-divider{border-color:#374151!important}`;

/** Header: tenant-logo (of tekst-wordmark) op een accentbalk. */
function header(branding: EmailBranding): string {
  const inner = branding.logoUrl
    ? `<img src="${escapeHtml(branding.logoUrl)}" alt="${escapeHtml(
        branding.name
      )}" width="160" style="display:block;max-width:160px;height:auto;border:0;margin:0 auto" />`
    : `<span style="font-size:22px;font-weight:800;letter-spacing:-0.02em;color:${branding.accentText}">${escapeHtml(
        branding.name
      )}</span>`;
  return `<tr>
    <td style="background:${branding.accent};padding:28px 32px;text-align:center" align="center">${inner}</td>
  </tr>`;
}

/** Footer: tenant-naam, contactgegevens, socials, reden + automatisch-bericht. */
function footer(branding: EmailBranding, reason: string, footerNote: string): string {
  const year = new Date().getFullYear();

  const contactBits: string[] = [];
  if (branding.address) contactBits.push(escapeHtml(branding.address));
  if (branding.contactPhone)
    contactBits.push(
      `<a href="tel:${escapeHtml(branding.contactPhone)}" style="color:#6b7280;text-decoration:none">${escapeHtml(
        branding.contactPhone
      )}</a>`
    );
  if (branding.contactEmail)
    contactBits.push(
      `<a href="mailto:${escapeHtml(branding.contactEmail)}" style="color:#6b7280;text-decoration:none">${escapeHtml(
        branding.contactEmail
      )}</a>`
    );
  if (branding.website)
    contactBits.push(
      `<a href="${escapeHtml(branding.website)}" style="color:#6b7280;text-decoration:none">${escapeHtml(
        branding.website.replace(/^https?:\/\//, "")
      )}</a>`
    );

  const socials =
    branding.socials.length > 0
      ? `<p class="dm-muted" style="margin:0 0 10px;font-size:13px;color:#6b7280">${branding.socials
          .map(
            (s) =>
              `<a href="${escapeHtml(s.url)}" style="color:#6b7280;text-decoration:underline;margin:0 6px">${escapeHtml(
                s.label
              )}</a>`
          )
          .join("")}</p>`
      : "";

  return `<tr>
    <td style="padding:24px 32px 32px;text-align:center;background:#ffffff" align="center" class="dm-card">
      <p style="margin:0 0 6px;font-size:14px;font-weight:600;color:#374151" class="dm-text">${escapeHtml(
        branding.name
      )}</p>
      ${
        contactBits.length
          ? `<p class="dm-muted" style="margin:0 0 10px;font-size:13px;line-height:1.6;color:#6b7280">${contactBits.join(
              " &middot; "
            )}</p>`
          : ""
      }
      ${socials}
      <p class="dm-muted" style="margin:0 0 4px;font-size:12px;line-height:1.5;color:#6b7280">${escapeHtml(
        reason
      )}</p>
      <p class="dm-muted" style="margin:0;font-size:12px;line-height:1.5;color:#6b7280">${escapeHtml(
        footerNote
      )}<br>&copy; ${year} ${escapeHtml(branding.name)}</p>
    </td>
  </tr>`;
}

export function renderEmailLayout(input: LayoutInput): string {
  const { branding, preheader, contentHtml, reason } = input;
  const footerNote =
    input.footerNote ?? "Dit is een automatisch gegenereerd bericht, beantwoorden is niet nodig.";
  const scheme = input.scheme ?? "auto";
  const colorScheme =
    scheme === "auto" ? "light dark" : scheme === "dark" ? "dark" : "light";
  const darkModeCss =
    scheme === "light"
      ? ""
      : scheme === "dark"
        ? DARK_RULES
        : `
  @media (prefers-color-scheme:dark){${DARK_RULES}
  }`;
  return `<!DOCTYPE html>
<html lang="${branding.locale.toLowerCase()}" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<meta name="color-scheme" content="${colorScheme}" />
<meta name="supported-color-schemes" content="${colorScheme}" />
<title>${escapeHtml(branding.name)}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<style>
  body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
  table,td{mso-table-lspace:0pt;mso-table-rspace:0pt}
  img{-ms-interpolation-mode:bicubic;border:0;outline:none;text-decoration:none}
  body{margin:0;padding:0;width:100%!important;background:#f3f4f6}
  @media only screen and (max-width:600px){
    .container{width:100%!important}
    .px{padding-left:20px!important;padding-right:20px!important}
  }
${darkModeCss}
</style>
</head>
<body style="margin:0;padding:0;background:#f3f4f6">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${escapeHtml(
    preheader
  )}</div>
<table role="presentation" class="dm-bg" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3f4f6">
  <tr>
    <td align="center" style="padding:24px 12px">
      <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;font-family:${
        branding.fontStack
      }">
        ${header(branding)}
        <tr>
          <td class="px dm-card dm-text" style="background:#ffffff;padding:32px;color:#1f2937;font-family:${
            branding.fontStack
          }">${contentHtml}</td>
        </tr>
        ${footer(branding, reason, footerNote)}
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}
