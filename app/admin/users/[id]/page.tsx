import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSuperadmin } from "@/lib/superadmin";
import { fmtDate, fmtDateTime, fmtSince } from "@/lib/schema-status";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { UserEditForm } from "./user-edit-form";
import { ROLE_LABEL, ROLE_TONE } from "../role-meta";
import { setUserActive, resetUserTwoFactor, revokeUserSessions, deleteUser } from "../actions";

function Card({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-surface-1 p-5 shadow-sm">
      <div>
        <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
        {description ? <p className="mt-1 text-sm text-neutral-500">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</dt>
      <dd className="text-sm text-neutral-900">{children}</dd>
    </div>
  );
}

const outlineBtn =
  "rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50";
const dangerBtn =
  "rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const user = await prisma.user.findUnique({ where: { id }, select: { name: true, email: true } });
  return { title: user ? `${user.name ?? user.email} | Gebruiker` : "Gebruiker" };
}

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await requireSuperadmin();
  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      active: true,
      archivedAt: true,
      createdAt: true,
      emailVerified: true,
      twoFactorEnabled: true,
      passwordHash: true,
      locale: true,
      memberNumber: true,
      pendingEmail: true,
      deletionRequestedAt: true,
      tenantId: true,
      tenant: { select: { id: true, name: true, slug: true } },
      homeLocation: { select: { name: true } },
      _count: { select: { authenticators: true } },
      userSessions: {
        where: { revokedAt: null },
        orderBy: { lastSeenAt: "desc" },
        take: 1,
        select: { lastSeenAt: true },
      },
    },
  });
  if (!user) notFound();

  const isSelf = user.id === admin.id;
  const activeSessions = await prisma.userSession.count({ where: { userId: user.id, revokedAt: null } });
  const lastSeen = user.userSessions[0]?.lastSeenAt ?? null;
  const displayName = user.name ?? user.email;

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <div>
        <Link href="/admin/users" className="text-sm text-neutral-500 hover:text-neutral-900">
          ← Gebruikers
        </Link>
        <div className="mt-3 flex items-start gap-4">
          <Avatar name={displayName} size="lg" status={user.active ? "online" : "offline"} />
          <div className="min-w-0">
            <h1 className="flex flex-wrap items-center gap-2 font-display text-2xl font-bold tracking-tight text-neutral-900">
              <span className="truncate">{displayName}</span>
              <Badge tone={ROLE_TONE[user.role] ?? "neutral"}>{ROLE_LABEL[user.role] ?? user.role}</Badge>
              {!user.active ? <Badge tone="warning">gedeactiveerd</Badge> : null}
              {user.archivedAt ? <Badge tone="neutral">gearchiveerd</Badge> : null}
              {isSelf ? <Badge tone="info">dit ben jij</Badge> : null}
            </h1>
            <p className="mt-1 truncate text-sm text-neutral-500">{user.email}</p>
            <p className="mt-1 text-sm text-neutral-500">
              {user.tenant ? (
                <Link href={`/admin/tenants/${user.tenant.id}`} className="text-accent hover:underline">
                  {user.tenant.name}
                </Link>
              ) : (
                <span className="text-neutral-400">platform (geen tenant)</span>
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card title="Gegevens" description="Naam, e-mailadres en rol van deze gebruiker.">
          <UserEditForm
            user={{
              id: user.id,
              name: user.name,
              email: user.email,
              role: user.role,
              tenantId: user.tenantId,
            }}
            isSelf={isSelf}
          />
        </Card>

        <Card title="Account" description="Alleen-lezen overzicht van de accountstatus.">
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Fact label="Aangemaakt">
              {fmtDate(user.createdAt)} <span className="text-neutral-500">· {fmtSince(user.createdAt)} geleden</span>
            </Fact>
            <Fact label="Laatst actief">{lastSeen ? fmtDateTime(lastSeen) : "—"}</Fact>
            <Fact label="E-mail geverifieerd">
              {user.emailVerified ? fmtDate(user.emailVerified) : <span className="text-amber-700">nog niet</span>}
            </Fact>
            <Fact label="Wachtwoord">{user.passwordHash ? "ingesteld" : "alleen magic link"}</Fact>
            <Fact label="Tweestapsverificatie">
              {user.twoFactorEnabled ? <span className="text-green-700">aan</span> : "uit"}
            </Fact>
            <Fact label="Toegangssleutels (passkeys)">{user._count.authenticators}</Fact>
            <Fact label="Actieve sessies">{activeSessions}</Fact>
            <Fact label="Taal">{user.locale ?? <span className="text-neutral-400">standaard</span>}</Fact>
            {user.tenant ? (
              <>
                <Fact label="Lidnummer">{user.memberNumber ?? <span className="text-neutral-400">—</span>}</Fact>
                <Fact label="Thuisvestiging">
                  {user.homeLocation?.name ?? <span className="text-neutral-400">—</span>}
                </Fact>
              </>
            ) : null}
            {user.pendingEmail ? (
              <Fact label="Wijziging e-mail in behandeling">
                <span className="text-amber-700">{user.pendingEmail}</span>
              </Fact>
            ) : null}
            {user.deletionRequestedAt ? (
              <Fact label="Verwijderverzoek">
                <span className="text-red-600">{fmtDate(user.deletionRequestedAt)}</span>
              </Fact>
            ) : null}
          </dl>
        </Card>
      </div>

      <Card
        title="Toegang"
        description="Support-acties. Elke actie wordt vastgelegd in het auditlog."
      >
        <div className="flex flex-wrap items-center gap-3">
          {isSelf ? (
            <p className="text-sm text-neutral-500">
              Je eigen account (de)activeer of verwijder je niet vanaf hier. Gebruik daarvoor je accountinstellingen.
            </p>
          ) : (
            <form action={setUserActive}>
              <input type="hidden" name="userId" value={user.id} />
              <input type="hidden" name="active" value={user.active ? "false" : "true"} />
              <button type="submit" className={outlineBtn}>
                {user.active ? "Deactiveren" : "Activeren"}
              </button>
            </form>
          )}
          <ConfirmButton
            action={revokeUserSessions}
            fields={{ userId: user.id }}
            label="Overal uitloggen"
            triggerClassName={outlineBtn}
            title={`${displayName} overal uitloggen?`}
            message="Alle ingelogde sessies en gekoppelde apparaten worden beëindigd. De gebruiker moet opnieuw inloggen."
            confirmLabel="Uitloggen"
            confirmVariant="primary"
          />
          {user.twoFactorEnabled ? (
            <ConfirmButton
              action={resetUserTwoFactor}
              fields={{ userId: user.id }}
              label="2FA uitschakelen"
              triggerClassName={outlineBtn}
              title="Tweestapsverificatie uitschakelen?"
              message="Gebruik dit alleen als de gebruiker aantoonbaar de authenticator kwijt is. Het account is daarna zonder tweede stap toegankelijk tot de gebruiker 2FA opnieuw instelt."
              confirmLabel="Uitschakelen"
              confirmVariant="primary"
            />
          ) : null}
        </div>
      </Card>

      {!isSelf ? (
        <Card
          title="Verwijderen"
          description="Onomkeerbaar. Trainingshistorie, metingen en aanmeldingen van deze gebruiker gaan mee."
        >
          <ConfirmButton
            action={deleteUser}
            fields={{ userId: user.id }}
            label="Gebruiker verwijderen"
            triggerClassName={dangerBtn}
            title={`${displayName} verwijderen?`}
            message={`Het account ${user.email}${user.tenant ? ` bij ${user.tenant.name}` : ""} wordt definitief verwijderd, inclusief alle gekoppelde gegevens. Dit kan niet ongedaan worden gemaakt.`}
            confirmLabel="Definitief verwijderen"
          />
        </Card>
      ) : null}
    </div>
  );
}
