import "server-only";

/**
 * Bouw een RFC 5322 / MIME `multipart/alternative`-bericht met zowel een
 * plain-text- als een HTML-deel, base64-gecodeerd als geheel. Microsoft Graph
 * accepteert dit via `POST /sendMail` met `Content-Type: text/plain`.
 *
 * Beide delen base64 (UTF-8) → geen quoted-printable-randgevallen of
 * regellengte-problemen; non-ASCII in de subject via RFC 2047 encoded-word.
 */
export type MimeInput = {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Optioneel Reply-To (bv. het afzenderadres van een contactbericht). */
  replyTo?: string;
};

const CRLF = "\r\n";

/** RFC 2047 encoded-word voor headers met non-ASCII (bv. tenantnaam in subject). */
function encodeHeader(value: string): string {
  // Alleen pure ASCII? Dan ongewijzigd; anders RFC 2047 encoded-word.
  if (/^[\x20-\x7E]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

/** Base64 in regels van 76 tekens (RFC 2045). */
function base64Lines(value: string): string {
  const b64 = Buffer.from(value, "utf8").toString("base64");
  return (b64.match(/.{1,76}/g) ?? [b64]).join(CRLF);
}

/** Bouw het MIME-bericht en geef het base64-gecodeerd terug (klaar voor Graph). */
export function buildMimeMessage(input: MimeInput): string {
  const boundary = `gymrebel_${Buffer.from(
    `${Date.now()}-${Math.random()}`
  ).toString("hex").slice(0, 24)}`;

  const message =
    [
      `From: ${input.from}`,
      `To: ${input.to}`,
      ...(input.replyTo ? [`Reply-To: ${input.replyTo}`] : []),
      `Subject: ${encodeHeader(input.subject)}`,
      "MIME-Version: 1.0",
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      "",
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: base64",
      "",
      base64Lines(input.text),
      "",
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      "Content-Transfer-Encoding: base64",
      "",
      base64Lines(input.html),
      "",
      `--${boundary}--`,
      "",
    ].join(CRLF);

  return Buffer.from(message, "utf8").toString("base64");
}
