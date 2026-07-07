import "server-only";
import {
  graphConfigured,
  graphSender,
  sendMailViaGraph,
  sendMimeViaGraph,
} from "@/lib/email/graph";
import { buildMimeMessage } from "@/lib/email/mime";
import type { EmailMessage } from "@/lib/email/messages";
import { getOutgoingEmailEnabled } from "@/lib/platform-settings";

/**
 * Uitkomst van een verzendpoging:
 *  - `"sent"`   → daadwerkelijk bij een transport (Graph) afgeleverd.
 *  - `"logged"` → alléén naar de server-console gelogd (geen transport
 *                 geconfigureerd, killswitch uit, of Graph faalde). Er is dus
 *                 níéts bij de ontvanger bezorgd.
 *
 * Callers gebruiken dit om niet valselijk "e-mail verzonden" te melden/auditen
 * (zie de notify-modules) wanneer er in werkelijkheid niets de deur uit ging.
 */
export type EmailDelivery = "sent" | "logged";

/**
 * Gecentraliseerde verzending voor álle uitgaande e-mails (vervangt de eerder
 * op drie plekken gedupliceerde Graph/console-logica). Gelaagde fallback,
 * faalt nooit hard zodat een mailfout een business-actie niet kan breken:
 *
 *  1. Graph + MIME  → multipart/alternative (HTML + plain-text).
 *  2. Graph + JSON  → HTML-only (backstop als de MIME-route faalt).
 *  3. Console       → nette dev-log met subject + (optionele) link.
 *
 * @returns `"sent"` alleen als stap 1 of 2 slaagde; anders `"logged"`.
 */
export async function sendEmail(opts: {
  to: string;
  message: EmailMessage;
  /** Optionele link die in de dev-console wordt getoond (magic link, invite, …). */
  devLink?: string;
  /** Optioneel Reply-To (bv. het afzenderadres bij een contactbericht). */
  replyTo?: string;
}): Promise<EmailDelivery> {
  const { to, message, devLink, replyTo } = opts;

  // Globale Superadmin-killswitch: staat uitgaande mail uit, dan versturen we
  // niets maar loggen we het bericht (zoals de dev-fallback). Fail-open: als de
  // DB niet bereikbaar is, liever versturen dan stil inslikken.
  let outgoingEnabled = true;
  try {
    outgoingEnabled = await getOutgoingEmailEnabled();
  } catch {
    /* fail-open */
  }

  if (graphConfigured() && outgoingEnabled) {
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
      return "sent";
    } catch (err) {
      console.error(
        "✗ Graph MIME-mail mislukt, fallback naar HTML:",
        (err as Error).message
      );
    }
    try {
      await sendMailViaGraph({ to, subject: message.subject, html: message.html, replyTo });
      return "sent";
    } catch (err) {
      console.error(
        "✗ Graph HTML-mail mislukt, fallback naar console:",
        (err as Error).message
      );
    }
  }

  // Development / geen transport / door de Superadmin gepauzeerd: log naar de
  // server-console (zoals voorheen).
  const prefix =
    graphConfigured() && !outgoingEnabled
      ? "⏸️  [GymRebel] uitgaande mail UIT — niet verstuurd:"
      : "✉️  [GymRebel]";
  console.log(
    `\n${prefix} "${message.subject}" → ${to}` +
      (devLink ? `\n${devLink}` : "") +
      "\n"
  );
  return "logged";
}
