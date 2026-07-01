import "server-only";
import {
  graphConfigured,
  graphSender,
  sendMailViaGraph,
  sendMimeViaGraph,
} from "@/lib/email/graph";
import { buildMimeMessage } from "@/lib/email/mime";
import type { EmailMessage } from "@/lib/email/messages";

/**
 * Gecentraliseerde verzending voor álle uitgaande e-mails (vervangt de eerder
 * op drie plekken gedupliceerde Graph/console-logica). Gelaagde fallback,
 * faalt nooit hard zodat een mailfout een business-actie niet kan breken:
 *
 *  1. Graph + MIME  → multipart/alternative (HTML + plain-text).
 *  2. Graph + JSON  → HTML-only (backstop als de MIME-route faalt).
 *  3. Console       → nette dev-log met subject + (optionele) link.
 */
export async function sendEmail(opts: {
  to: string;
  message: EmailMessage;
  /** Optionele link die in de dev-console wordt getoond (magic link, invite, …). */
  devLink?: string;
  /** Optioneel Reply-To (bv. het afzenderadres bij een contactbericht). */
  replyTo?: string;
}): Promise<void> {
  const { to, message, devLink, replyTo } = opts;

  if (graphConfigured()) {
    const sender = graphSender();
    try {
      const mime = buildMimeMessage({
        from: sender ?? "no-reply@gymrebel.app",
        to,
        subject: message.subject,
        html: message.html,
        text: message.text,
        replyTo,
      });
      await sendMimeViaGraph(mime);
      return;
    } catch (err) {
      console.error(
        "✗ Graph MIME-mail mislukt, fallback naar HTML:",
        (err as Error).message
      );
    }
    try {
      await sendMailViaGraph({ to, subject: message.subject, html: message.html, replyTo });
      return;
    } catch (err) {
      console.error(
        "✗ Graph HTML-mail mislukt, fallback naar console:",
        (err as Error).message
      );
    }
  }

  // Development / geen transport: log naar de server-console (zoals voorheen).
  console.log(
    `\n✉️  [GymRebel] "${message.subject}" → ${to}` +
      (devLink ? `\n${devLink}` : "") +
      "\n"
  );
}
