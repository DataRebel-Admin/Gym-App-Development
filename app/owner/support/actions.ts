"use server";

import { prisma } from "@/lib/db";
import { requireTenantUser } from "@/lib/staff";
import { audit } from "@/lib/audit";
import { getSupportEmail } from "@/lib/platform-settings";
import { resolveEmailBranding } from "@/lib/email/branding";
import { supportRequestMessage } from "@/lib/email/messages";
import { sendEmail } from "@/lib/email/send";
import {
  supportMessageSchema,
  supportCategoryLabel,
  supportPriorityLabel,
} from "@/lib/support";

export type SupportFormState = { ok?: boolean; error?: string };

/**
 * Verwerk een contactbericht van een sportschooleigenaar/medewerker. Afzender-
 * gegevens (naam, e-mail, sportschool) worden server-side afgeleid — niet uit de
 * client vertrouwd. Verzendt via de bestaande mailarchitectuur naar het
 * (configureerbare) support-adres; het afzenderadres wordt als Reply-To gezet.
 * Best-effort audit; een mailfout wordt netjes teruggemeld.
 */
export async function sendSupportMessage(
  _prev: SupportFormState,
  formData: FormData
): Promise<SupportFormState> {
  const user = await requireTenantUser();

  const parsed = supportMessageSchema.safeParse({
    subject: formData.get("subject") ?? "",
    message: formData.get("message") ?? "",
    category: formData.get("category") ?? undefined,
    priority: formData.get("priority") ?? undefined,
  });
  if (!parsed.success) {
    return { error: "Controleer het onderwerp en bericht (min. 3 en 10 tekens)." };
  }
  const { subject, message, category, priority } = parsed.data;

  const tenant = await prisma.tenant.findUnique({
    where: { id: user.tenantId },
    select: { name: true },
  });

  const senderName = user.name?.trim() || user.email || "Onbekende afzender";
  const senderEmail = user.email ?? "";
  const gymName = tenant?.name ?? "Onbekende sportschool";
  const submittedAt = new Date();

  try {
    const to = await getSupportEmail();
    const msg = await supportRequestMessage({
      branding: resolveEmailBranding(null), // platform-mail → GymRebel-default huisstijl
      senderName,
      senderEmail,
      gymName,
      subject,
      categoryLabel: supportCategoryLabel(category),
      priorityLabel: supportPriorityLabel(priority),
      message,
      submittedAt,
    });
    await sendEmail({ to, message: msg, replyTo: senderEmail || undefined });
  } catch (err) {
    console.error("✗ Supportbericht verzenden mislukt:", (err as Error).message);
    return { error: "Verzenden is niet gelukt. Probeer het later opnieuw." };
  }

  await audit("support.send", {
    actor: user,
    tenantId: user.tenantId,
    metadata: { subject, category, priority },
  });

  return { ok: true };
}

/** Log dat het contactformulier is geopend (best-effort, niet-blokkerend). */
export async function logSupportOpened(): Promise<void> {
  const user = await requireTenantUser();
  await audit("support.open", { actor: user, tenantId: user.tenantId });
}
