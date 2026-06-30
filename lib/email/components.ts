import "server-only";
import type { EmailBranding } from "@/lib/email/branding";

/**
 * Herbruikbare e-mail-bouwstenen: pure string-builders die table-safe, volledig
 * inline-gestylede HTML teruggeven. Inline CSS = maximale clientcompatibiliteit
 * (Outlook/Gmail strippen <style>-regels deels). Gedeelde kleuren/typografie
 * komen uit de EmailBranding zodat elke knop/kop de tenant-huisstijl volgt.
 */

const INK = "#1f2937"; // body-tekst
const MUTED = "#6b7280"; // bijschrift

/** Escape voor alle waarden die uit gebruikers-/tenant-input komen (anti-injectie). */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function emailHeading(text: string): string {
  return `<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;font-weight:700;color:${INK}">${escapeHtml(
    text
  )}</h1>`;
}

export function emailParagraph(html: string): string {
  return `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${INK}">${html}</p>`;
}

export function emailMuted(html: string): string {
  return `<p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:${MUTED}">${html}</p>`;
}

export function emailDivider(): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:8px 0"><div style="border-top:1px solid #e5e7eb;font-size:1px;line-height:1px">&nbsp;</div></td></tr></table>`;
}

/**
 * Bulletproof CTA-knop in de tenant-kleur. De VML (MSO conditional comment)
 * geeft Outlook een echte gevulde knop; andere clients zien de <a>.
 */
export function emailButton(
  href: string,
  label: string,
  branding: EmailBranding
): string {
  const safeHref = escapeHtml(href);
  const safeLabel = escapeHtml(label);
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 4px">
    <tr>
      <td align="center" bgcolor="${branding.accent}" style="border-radius:10px">
        <!--[if mso]>
        <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${safeHref}" style="height:48px;v-text-anchor:middle;width:280px" arcsize="20%" strokecolor="${branding.accent}" fillcolor="${branding.accent}">
        <w:anchorlock/>
        <center style="color:${branding.accentText};font-family:sans-serif;font-size:16px;font-weight:bold">${safeLabel}</center>
        </v:roundrect>
        <![endif]-->
        <!--[if !mso]><!-->
        <a href="${safeHref}" target="_blank" style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:600;line-height:1;color:${branding.accentText};text-decoration:none;border-radius:10px;background:${branding.accent}">${safeLabel}</a>
        <!--<![endif]-->
      </td>
    </tr>
  </table>`;
}

/** Onopvallende link-fallback ("werkt de knop niet?"). */
export function emailLinkFallback(url: string): string {
  return emailMuted(
    `Werkt de knop niet? Kopieer en plak deze link in je browser:<br><a href="${escapeHtml(
      url
    )}" target="_blank" style="color:${MUTED};word-break:break-all">${escapeHtml(
      url
    )}</a>`
  );
}

/** Subtiele info-/waarschuwingskaart (afgeronde hoeken, zachte achtergrond). */
export function emailInfoCard(html: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 16px">
    <tr>
      <td style="padding:14px 16px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;font-size:14px;line-height:1.6;color:${INK}">${html}</td>
    </tr>
  </table>`;
}
