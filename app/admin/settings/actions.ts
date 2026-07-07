"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireSuperadmin } from "@/lib/superadmin";
import { audit } from "@/lib/audit";
import {
  getSupportEmail,
  setSupportEmail,
  getOutgoingEmailEnabled,
  setOutgoingEmailEnabled,
} from "@/lib/platform-settings";

export type SupportEmailState = { ok?: boolean; error?: string };

const schema = z.object({ email: z.string().trim().email() });

/**
 * Werk het support-e-mailadres bij (platform-instelling, géén redeploy nodig).
 * Alleen Superadmin. Contactberichten van sportschooleigenaren gaan hierheen.
 */
export async function updateSupportEmail(
  _prev: SupportEmailState,
  formData: FormData
): Promise<SupportEmailState> {
  const admin = await requireSuperadmin();

  const parsed = schema.safeParse({ email: formData.get("email") ?? "" });
  if (!parsed.success) return { error: "Voer een geldig e-mailadres in." };

  const previous = await getSupportEmail();
  const next = parsed.data.email;
  if (next === previous) return { ok: true };

  await setSupportEmail(next, { id: admin.id, email: admin.email });

  await audit("platform.settings.update", {
    actor: admin,
    metadata: { setting: "support.email" },
    oldValue: { email: previous },
    newValue: { email: next },
  });

  revalidatePath("/admin/settings");
  return { ok: true };
}

export type OutgoingEmailState = { ok?: boolean; error?: string; enabled?: boolean };

const outgoingSchema = z.object({ enabled: z.enum(["on", "off"]) });

/**
 * Globale killswitch voor álle uitgaande transactionele e-mail (platform-breed,
 * géén redeploy). Alleen Superadmin. Uit = `sendEmail` short-circuit; de owner
 * krijgt dus geen echte mail (handig tijdens ontwikkeling/testen).
 */
export async function updateOutgoingEmail(
  _prev: OutgoingEmailState,
  formData: FormData
): Promise<OutgoingEmailState> {
  const admin = await requireSuperadmin();

  const parsed = outgoingSchema.safeParse({ enabled: formData.get("enabled") ?? "" });
  if (!parsed.success) return { error: "Ongeldige waarde." };

  const previous = await getOutgoingEmailEnabled();
  const next = parsed.data.enabled === "on";
  if (next === previous) return { ok: true, enabled: next };

  await setOutgoingEmailEnabled(next, { id: admin.id, email: admin.email });

  await audit("platform.settings.update", {
    actor: admin,
    metadata: { setting: "email.outgoing" },
    oldValue: { enabled: previous },
    newValue: { enabled: next },
  });

  revalidatePath("/admin/settings");
  return { ok: true, enabled: next };
}
