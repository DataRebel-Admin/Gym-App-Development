"use server";

import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOwner } from "@/lib/owner";
import { audit } from "@/lib/audit";
import { createInvitation } from "@/lib/invitation";
import { importRowSchema, type ImportRowInput } from "@/lib/member-import";

async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3001";
  const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export type ChunkResult = {
  created: number;
  skipped: number;
  /** E-mails (genormaliseerd) van de daadwerkelijk aangemaakte leden. */
  createdEmails: string[];
};

const chunkSchema = z.array(importRowSchema).max(500);

/**
 * Importeert één batch leden. Bewust per chunk aangeroepen door de client
 * (batches van ~100) zodat de voortgang echt is en grote bestanden (1.000+)
 * niet in één request-time-out lopen. Dubbele e-mails (t.o.v. bestaande leden
 * én binnen de batch) worden overgeslagen; een botsend lidnummer wordt geleegd
 * zodat het lid alsnog wordt aangemaakt. `createMany` is atomair per batch.
 */
export async function importMembersChunk(rows: ImportRowInput[]): Promise<ChunkResult> {
  const owner = await requireOwner();
  const parsed = chunkSchema.safeParse(rows);
  if (!parsed.success) return { created: 0, skipped: rows.length, createdEmails: [] };
  const input = parsed.data;
  if (input.length === 0) return { created: 0, skipped: 0, createdEmails: [] };

  // Welke e-mails / lidnummers bestaan al in deze tenant?
  const emails = input.map((r) => r.email);
  const memberNumbers = input.map((r) => r.memberNumber).filter((m): m is string => m !== "");

  const [existingUsers, existingMembers] = await Promise.all([
    prisma.user.findMany({
      where: { tenantId: owner.tenantId, email: { in: emails } },
      select: { email: true },
    }),
    memberNumbers.length
      ? prisma.user.findMany({
          where: { tenantId: owner.tenantId, memberNumber: { in: memberNumbers } },
          select: { memberNumber: true },
        })
      : Promise.resolve([] as { memberNumber: string | null }[]),
  ]);
  const existingEmail = new Set(existingUsers.map((u) => u.email));
  const existingMember = new Set(
    existingMembers.map((u) => u.memberNumber).filter((m): m is string => Boolean(m))
  );

  const seenEmail = new Set<string>();
  const seenMember = new Set<string>();
  const data: Prisma.UserCreateManyInput[] = [];
  const createdEmails: string[] = [];
  let skipped = 0;

  for (const r of input) {
    if (existingEmail.has(r.email) || seenEmail.has(r.email)) {
      skipped++;
      continue;
    }
    seenEmail.add(r.email);

    let memberNumber: string | null = r.memberNumber || null;
    if (memberNumber && (existingMember.has(memberNumber) || seenMember.has(memberNumber))) {
      memberNumber = null; // botsing → leeg, lid wordt toch aangemaakt
    }
    if (memberNumber) seenMember.add(memberNumber);

    const name = `${r.firstName} ${r.lastName}`.trim();
    data.push({
      tenantId: owner.tenantId,
      email: r.email,
      name: name || null,
      firstName: r.firstName,
      lastName: r.lastName || null,
      phone: r.phone || null,
      birthDate: r.birthDate ? new Date(`${r.birthDate}T00:00:00.000Z`) : null,
      gender: r.gender,
      memberNumber,
      role: r.role,
      active: true,
    });
    createdEmails.push(r.email);
  }

  if (data.length === 0) return { created: 0, skipped, createdEmails: [] };

  const res = await prisma.user.createMany({ data, skipDuplicates: true });
  return { created: res.count, skipped, createdEmails };
}

/** Schrijft één audit-regel voor de volledige import-run (na alle batches). */
export async function logImport(summary: { created: number; skipped: number }) {
  const owner = await requireOwner();
  const parsed = z
    .object({ created: z.number().int().min(0), skipped: z.number().int().min(0) })
    .safeParse(summary);
  if (!parsed.success) return;
  await audit("user.import", {
    actor: owner,
    tenantId: owner.tenantId,
    targetType: "User",
    metadata: parsed.data,
  });
  revalidatePath("/owner/members");
}

export type InviteResult = { invited: number; failed: number };

/**
 * Verstuurt uitnodigingen voor een geselecteerde set zojuist geïmporteerde
 * leden. Hergebruikt `createInvitation` (branded mail via `lib/email/*`).
 * Best-effort per lid: één fout breekt de rest niet. Eén audit-regel voor de set.
 */
export async function sendImportInvites(emails: string[]): Promise<InviteResult> {
  const owner = await requireOwner();
  const parsed = z.array(z.string().trim().toLowerCase().email()).max(2000).safeParse(emails);
  if (!parsed.success) return { invited: 0, failed: emails.length };

  // Alleen e-mails die echt als lid in deze tenant bestaan.
  const unique = [...new Set(parsed.data)];
  const members = await prisma.user.findMany({
    where: { tenantId: owner.tenantId, email: { in: unique }, role: { in: ["TENANT_ADMIN", "TENANT_MEMBER"] } },
    select: { email: true, role: true },
  });

  const base = await origin();
  let invited = 0;
  let failed = 0;
  for (const m of members) {
    try {
      await createInvitation({
        tenantId: owner.tenantId,
        email: m.email,
        role: m.role,
        invitedById: owner.id,
        origin: base,
      });
      invited++;
    } catch (err) {
      failed++;
      console.error(`[member-import] uitnodiging mislukt voor ${m.email}:`, err);
    }
  }

  if (invited > 0) {
    await audit("user.invite", {
      actor: owner,
      tenantId: owner.tenantId,
      targetType: "Invitation",
      metadata: { email: `${invited} nieuwe leden` },
    });
  }

  revalidatePath("/owner/members");
  return { invited, failed };
}
