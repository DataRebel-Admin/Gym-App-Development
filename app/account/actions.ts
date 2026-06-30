"use server";

import { z } from "zod";
import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAccount } from "@/lib/account";
import { uploadAvatar } from "@/lib/blob";
import { audit } from "@/lib/audit";
import { graphConfigured, sendMailViaGraph } from "@/lib/email/graph";
import type { Role } from "@prisma/client";

export type AccountFormState = { ok?: boolean; error?: string };

function actorOf(u: { id: string; email: string | null; role: Role; tenantId?: string | null }) {
  return { id: u.id, email: u.email, role: u.role };
}

async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

const profileSchema = z.object({
  firstName: z.string().trim().max(80).optional().or(z.literal("")),
  lastName: z.string().trim().max(80).optional().or(z.literal("")),
  jobTitle: z.string().trim().max(120).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  timezone: z.string().trim().max(64).optional().or(z.literal("")),
  locale: z.enum(["NL", "EN", "FY"]).optional().or(z.literal("")),
});

/** Profiel opslaan (autosave). `name` blijft in sync met voor/achternaam. */
export async function saveProfile(
  _prev: AccountFormState,
  formData: FormData
): Promise<AccountFormState> {
  const session = await requireAccount();
  const parsed = profileSchema.safeParse({
    firstName: formData.get("firstName") ?? "",
    lastName: formData.get("lastName") ?? "",
    jobTitle: formData.get("jobTitle") ?? "",
    phone: formData.get("phone") ?? "",
    timezone: formData.get("timezone") ?? "",
    locale: formData.get("locale") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ongeldige invoer" };
  const d = parsed.data;

  const first = d.firstName?.trim() || null;
  const last = d.lastName?.trim() || null;
  const name = [first, last].filter(Boolean).join(" ") || null;

  await prisma.user.update({
    where: { id: session.id },
    data: {
      firstName: first,
      lastName: last,
      jobTitle: d.jobTitle?.trim() || null,
      phone: d.phone?.trim() || null,
      timezone: d.timezone?.trim() || null,
      locale: d.locale ? (d.locale as "NL" | "EN" | "FY") : null,
      name,
    },
  });

  await audit("profile.update", {
    actor: actorOf({ id: session.id, email: session.email ?? null, role: session.role }),
    tenantId: session.tenantId ?? null,
    targetType: "User",
    targetId: session.id,
  });

  revalidatePath("/account");
  return { ok: true };
}

/** Profielfoto uploaden (vereist BLOB_READ_WRITE_TOKEN; degradeert netjes). */
export async function updateAvatar(
  _prev: AccountFormState,
  formData: FormData
): Promise<AccountFormState> {
  const session = await requireAccount();
  const file = formData.get("avatar");
  const url = await uploadAvatar(file instanceof File ? file : null, session.id);
  if (!url) return { error: "Upload niet beschikbaar (geen Blob-token) of geen bestand." };

  await prisma.user.update({ where: { id: session.id }, data: { image: url } });
  await audit("profile.avatar", {
    actor: actorOf({ id: session.id, email: session.email ?? null, role: session.role }),
    tenantId: session.tenantId ?? null,
    targetType: "User",
    targetId: session.id,
  });
  revalidatePath("/account");
  return { ok: true };
}

const emailSchema = z.object({ email: z.string().trim().email() });

/** Verzoek tot e-mailwijziging: zet pendingEmail + verstuurt verificatielink. */
export async function requestEmailChange(
  _prev: AccountFormState,
  formData: FormData
): Promise<AccountFormState> {
  const session = await requireAccount();
  const parsed = emailSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: "Ongeldig e-mailadres" };
  const newEmail = parsed.data.email.toLowerCase();

  const me = await prisma.user.findUnique({
    where: { id: session.id },
    select: { email: true, tenantId: true, role: true },
  });
  if (!me) return { error: "Account niet gevonden" };
  if (newEmail === me.email.toLowerCase()) return { error: "Dit is al je huidige e-mailadres" };

  // Uniek binnen tenant (of globaal voor superadmin).
  const clash = me.tenantId
    ? await prisma.user.findUnique({ where: { tenantId_email: { tenantId: me.tenantId, email: newEmail } } })
    : await prisma.user.findFirst({ where: { email: newEmail, tenantId: null } });
  if (clash) return { error: "Dit e-mailadres is al in gebruik" };

  const token = randomBytes(24).toString("hex");
  await prisma.user.update({
    where: { id: session.id },
    data: {
      pendingEmail: newEmail,
      emailChangeToken: token,
      emailChangeExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  const url = `${await origin()}/account/verify-email/${token}`;
  const html = `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px">
    <h1 style="font-size:20px">Bevestig je nieuwe e-mailadres</h1>
    <p style="color:#525252">Klik om je e-mailadres voor GymRebel te wijzigen naar <strong>${newEmail}</strong>.</p>
    <p style="margin:24px 0"><a href="${url}" style="background:#171717;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600">Bevestigen</a></p>
    <p style="color:#a3a3a3;font-size:12px">Niet aangevraagd? Negeer deze mail.</p></div>`;
  if (graphConfigured()) {
    try {
      await sendMailViaGraph({ to: newEmail, subject: "Bevestig je nieuwe e-mailadres", html });
    } catch {
      console.log(`\n✉️  [GymRebel] E-mail wijzigen — bevestig:\n${url}\n`);
    }
  } else {
    console.log(`\n✉️  [GymRebel] E-mail wijzigen — bevestig:\n${url}\n`);
  }

  await audit("email.change.requested", {
    actor: actorOf({ id: session.id, email: me.email, role: me.role }),
    tenantId: me.tenantId ?? null,
    targetType: "User",
    targetId: session.id,
    metadata: { pendingEmail: newEmail },
  });

  revalidatePath("/account");
  return { ok: true };
}

/** Meldingsvoorkeuren opslaan (autosave). Het hele matrix-object komt als JSON binnen. */
export async function saveNotificationPrefs(
  _prev: AccountFormState,
  formData: FormData
): Promise<AccountFormState> {
  const session = await requireAccount();
  let prefs: unknown;
  try {
    prefs = JSON.parse(String(formData.get("prefs") ?? "{}"));
  } catch {
    return { error: "Ongeldige invoer" };
  }
  if (typeof prefs !== "object" || prefs === null) return { error: "Ongeldige invoer" };

  await prisma.user.update({
    where: { id: session.id },
    data: { notificationPrefs: prefs as object },
  });
  revalidatePath("/account/meldingen");
  return { ok: true };
}

/** Privacy-toestemmingen opslaan (autosave). */
export async function saveConsents(
  _prev: AccountFormState,
  formData: FormData
): Promise<AccountFormState> {
  const session = await requireAccount();
  let consents: unknown;
  try {
    consents = JSON.parse(String(formData.get("consents") ?? "{}"));
  } catch {
    return { error: "Ongeldige invoer" };
  }
  if (typeof consents !== "object" || consents === null) return { error: "Ongeldige invoer" };

  await prisma.user.update({
    where: { id: session.id },
    data: { consents: consents as object },
  });
  await audit("privacy.consent.update", {
    actor: actorOf({ id: session.id, email: session.email ?? null, role: session.role }),
    tenantId: session.tenantId ?? null,
    targetType: "User",
    targetId: session.id,
  });
  revalidatePath("/account/privacy");
  return { ok: true };
}

/** Verzoek tot accountverwijdering (zet vlag; daadwerkelijke verwijdering is handmatig). */
export async function requestAccountDeletion(formData: FormData) {
  const session = await requireAccount();
  const cancel = formData.get("cancel") === "true";
  await prisma.user.update({
    where: { id: session.id },
    data: { deletionRequestedAt: cancel ? null : new Date() },
  });
  await audit(cancel ? "account.deletion.cancel" : "account.deletion.request", {
    actor: actorOf({ id: session.id, email: session.email ?? null, role: session.role }),
    tenantId: session.tenantId ?? null,
    targetType: "User",
    targetId: session.id,
  });
  revalidatePath("/account/privacy");
}
