import "server-only";
import { randomBytes } from "node:crypto";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { loadTenantBranding } from "@/lib/email/branding";
import { inviteMessage } from "@/lib/email/messages";
import { sendEmail } from "@/lib/email/send";
import { shouldNotifyByEmail } from "@/lib/notifications";

/** 32-hex-karakter uitnodigingstoken. */
export function inviteToken(): string {
  return randomBytes(16).toString("hex");
}

/** Vervaldatum: 7 dagen vanaf nu. */
export function inviteExpiry(): Date {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
}

/**
 * Verstuur de uitnodigingsmail met de huisstijl van de tenant. Met Microsoft
 * Graph geconfigureerd gaat 'ie echt de deur uit; anders (dev) naar de
 * server-console — afgehandeld door `sendEmail`.
 */
export async function sendInviteEmail(opts: {
  email: string;
  tenantId: string;
  acceptUrl: string;
}): Promise<void> {
  const branding = await loadTenantBranding(opts.tenantId);
  await sendEmail({
    to: opts.email,
    message: await inviteMessage({ branding, acceptUrl: opts.acceptUrl }),
    devLink: opts.acceptUrl,
  });
}

/**
 * Maak (of ververs) een uitnodiging en verstuur de mail in één keer. Centrale
 * helper voor élk uitnodig-pad (superadmin én tenant-admin): nieuwe token +
 * vervaldatum, `acceptedAt` reset, en de branded mail eruit. Eén bron van waarheid.
 */
export async function createInvitation(opts: {
  tenantId: string;
  email: string;
  role: Role;
  invitedById: string | null;
  origin: string;
}): Promise<void> {
  const token = inviteToken();
  await prisma.invitation.upsert({
    where: { tenantId_email: { tenantId: opts.tenantId, email: opts.email } },
    update: { role: opts.role, token, expiresAt: inviteExpiry(), invitedById: opts.invitedById, acceptedAt: null },
    create: { tenantId: opts.tenantId, email: opts.email, role: opts.role, token, expiresAt: inviteExpiry(), invitedById: opts.invitedById },
  });
  // De uitnodiging (token) wordt altijd aangemaakt; de e-mail respecteert de
  // meldingsvoorkeur van een bestaand account. Een nieuw lid heeft nog geen
  // voorkeuren → standaard wél versturen.
  if (await shouldNotifyByEmail(opts.tenantId, opts.email, "invitations")) {
    await sendInviteEmail({
      email: opts.email,
      tenantId: opts.tenantId,
      acceptUrl: `${opts.origin}/invite/${token}`,
    });
  }
}

export type PendingInviteStatus = "VERZONDEN" | "VERLOPEN";

export type PendingInvitationRow = {
  id: string;
  email: string;
  role: Role;
  tenantId: string;
  tenantName: string;
  expiresAt: Date;
  createdAt: Date;
  invitedByName: string | null;
  invitedByEmail: string | null;
  status: PendingInviteStatus;
  /** Bestaat er al een account met dit e-mailadres in deze tenant? */
  hasAccount: boolean;
};

/**
 * Uitstaande (nog niet geaccepteerde) uitnodigingen. Zonder `tenantId`
 * platformbreed (superadmin); mét `tenantId` gescoped op één tenant (tenant-admin).
 */
export async function listPendingInvitations(
  opts: { tenantId?: string } = {}
): Promise<PendingInvitationRow[]> {
  const invitations = await prisma.invitation.findMany({
    where: { acceptedAt: null, ...(opts.tenantId ? { tenantId: opts.tenantId } : {}) },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      role: true,
      tenantId: true,
      expiresAt: true,
      createdAt: true,
      invitedById: true,
      tenant: { select: { name: true } },
    },
  });
  if (invitations.length === 0) return [];

  // Uitnodiger-namen (geen FK-relatie op het model → losse batch-lookup).
  const inviterIds = [
    ...new Set(invitations.map((i) => i.invitedById).filter((x): x is string => Boolean(x))),
  ];
  const inviters = inviterIds.length
    ? await prisma.user.findMany({
        where: { id: { in: inviterIds } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const inviterById = new Map(inviters.map((u) => [u.id, u]));

  // Welke (tenant, e-mail)-paren hebben al een account?
  const accounts = await prisma.user.findMany({
    where: { OR: invitations.map((i) => ({ tenantId: i.tenantId, email: i.email })) },
    select: { tenantId: true, email: true },
  });
  const accountKeys = new Set(accounts.map((a) => `${a.tenantId}:${a.email}`));

  const now = new Date();
  return invitations.map((i) => {
    const inviter = i.invitedById ? inviterById.get(i.invitedById) : undefined;
    return {
      id: i.id,
      email: i.email,
      role: i.role,
      tenantId: i.tenantId,
      tenantName: i.tenant.name,
      expiresAt: i.expiresAt,
      createdAt: i.createdAt,
      invitedByName: inviter?.name ?? null,
      invitedByEmail: inviter?.email ?? null,
      status: i.expiresAt > now ? "VERZONDEN" : "VERLOPEN",
      hasAccount: accountKeys.has(`${i.tenantId}:${i.email}`),
    };
  });
}
