import "server-only";
import { randomBytes } from "node:crypto";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { loadTenantBranding } from "@/lib/email/branding";
import { inviteMessage } from "@/lib/email/messages";
import { sendEmail, type EmailDelivery } from "@/lib/email/send";

/** Actor voor de bezorg-auditregel (uitnodiger, of het systeem bij self-service). */
export type InvitationActor = {
  id?: string | null;
  email?: string | null;
  role?: Role | null;
};

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
}): Promise<EmailDelivery> {
  const branding = await loadTenantBranding(opts.tenantId);
  return sendEmail({
    to: opts.email,
    message: await inviteMessage({ branding, acceptUrl: opts.acceptUrl }),
    devLink: opts.acceptUrl,
  });
}

/**
 * Maak (of ververs) een uitnodiging en verstuur de mail in één keer. Centrale
 * helper voor élk uitnodig-pad (superadmin én tenant-admin): nieuwe token +
 * vervaldatum, `acceptedAt` reset, en de branded mail eruit. Eén bron van waarheid.
 *
 * **Een uitnodiging is transactioneel, geen melding.** Ze loopt daarom bewust
 * NIET langs `shouldNotifyByEmail` — net als de magic link en de e-mail-
 * verificatie: zonder deze mail komt de ontvanger het platform niet binnen, dus
 * een uitgezette voorkeur mag hem niet tegenhouden. Eerder gebeurde dat wél, en
 * omdat e-mail per categorie standaard UIT staat (alleen `schemas` staat aan)
 * verdween elke uitnodiging naar een adres dat al een account had stilletjes,
 * terwijl de UI "opnieuw verzonden" meldde.
 *
 * Het bezorgresultaat wordt hier centraal geaudit (`user.invite.email`) zodat
 * geen enkel uitnodig-pad dat kan vergeten, en teruggegeven zodat de aanroeper
 * de gebruiker de waarheid kan tonen.
 */
export async function createInvitation(opts: {
  tenantId: string;
  email: string;
  role: Role;
  invitedById: string | null;
  origin: string;
  /** Actor voor de bezorg-auditregel; standaard de uitnodiger. */
  actor?: InvitationActor;
}): Promise<EmailDelivery> {
  const token = inviteToken();
  await prisma.invitation.upsert({
    where: { tenantId_email: { tenantId: opts.tenantId, email: opts.email } },
    update: { role: opts.role, token, expiresAt: inviteExpiry(), invitedById: opts.invitedById, acceptedAt: null },
    create: { tenantId: opts.tenantId, email: opts.email, role: opts.role, token, expiresAt: inviteExpiry(), invitedById: opts.invitedById },
  });

  const delivery = await sendInviteEmail({
    email: opts.email,
    tenantId: opts.tenantId,
    acceptUrl: `${opts.origin}/invite/${token}`,
  });

  await audit("user.invite.email", {
    actor: opts.actor ?? { id: opts.invitedById },
    tenantId: opts.tenantId,
    targetType: "Invitation",
    // Niet bezorgd = FAILED, zodat het in de auditfilters opvalt in plaats van
    // weg te vallen tussen de geslaagde verzendingen.
    status: delivery === "sent" ? "SUCCESS" : "FAILED",
    metadata: { email: opts.email, delivery },
  });

  return delivery;
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
  /**
   * Uitkomst van de laatste verzendpoging, afgeleid uit de auditregel
   * `user.invite.email` (geen extra kolom, zoals de statustijdlijn bij
   * app-meldingen). `null` = geen auditregel gevonden (bv. een uitnodiging van
   * vóór deze registratie) → status onbekend, niet "niet verzonden".
   */
  lastDelivery: EmailDelivery | null;
};

/**
 * Laatste bezorguitkomst per (tenant, e-mail), uit het auditlog. Bewust één
 * batch-query voor de hele lijst; `@@index([action, createdAt])` dekt hem af.
 */
async function lastDeliveryByKey(
  invitations: { tenantId: string; email: string; createdAt: Date }[]
): Promise<Map<string, EmailDelivery>> {
  const oldest = invitations.reduce(
    (min, i) => (i.createdAt < min ? i.createdAt : min),
    invitations[0].createdAt
  );
  const logs = await prisma.auditLog.findMany({
    where: { action: "user.invite.email", createdAt: { gte: oldest } },
    orderBy: { createdAt: "desc" },
    select: { tenantId: true, metadata: true },
    take: 2000,
  });

  const byKey = new Map<string, EmailDelivery>();
  for (const log of logs) {
    const meta = log.metadata as Record<string, unknown> | null;
    const email = typeof meta?.email === "string" ? meta.email : null;
    const delivery = meta?.delivery;
    if (!email || (delivery !== "sent" && delivery !== "logged")) continue;
    const key = `${log.tenantId}:${email}`;
    // Aflopend gesorteerd → de eerste hit is de meest recente poging.
    if (!byKey.has(key)) byKey.set(key, delivery);
  }
  return byKey;
}

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

  const deliveryByKey = await lastDeliveryByKey(invitations);

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
      lastDelivery: deliveryByKey.get(`${i.tenantId}:${i.email}`) ?? null,
    };
  });
}
