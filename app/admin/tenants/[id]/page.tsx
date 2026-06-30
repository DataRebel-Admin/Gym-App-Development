import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSuperadmin } from "@/lib/superadmin";
import { setTenantStatus, deleteTenant } from "../actions";
import { TenantEditForm, TenantBrandingForm } from "./tenant-edit-forms";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import {
  inviteToTenant,
  revokeInvitation,
  setMemberRole,
  setMemberActive,
  deleteMember,
} from "./user-actions";

const ROLE_LABEL: Record<string, string> = {
  SUPERADMIN: "Superadmin",
  TENANT_ADMIN: "Tenant-admin",
  TENANT_MEMBER: "Lid",
};

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
        {description ? (
          <p className="mt-1 text-sm text-neutral-500">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSuperadmin();
  const { id } = await params;

  const tenant = await prisma.tenant.findFirst({
    where: { id, deletedAt: null },
  });
  if (!tenant) notFound();

  const [users, invitations] = await Promise.all([
    prisma.user.findMany({
      where: { tenantId: tenant.id },
      orderBy: [{ role: "asc" }, { name: "asc" }],
      select: { id: true, email: true, name: true, role: true, active: true },
    }),
    prisma.invitation.findMany({
      where: { tenantId: tenant.id, acceptedAt: null },
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, role: true, expiresAt: true },
    }),
  ]);

  const active = tenant.status === "ACTIVE";

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/tenants" className="text-sm text-neutral-500 hover:text-neutral-900">
            ← Tenants
          </Link>
          <h1 className="mt-2 flex items-center gap-3 font-display text-2xl font-bold tracking-tight text-neutral-900">
            {tenant.name}
            <Badge tone={active ? "success" : "neutral"}>
              {active ? "Actief" : "Inactief"}
            </Badge>
          </h1>
          <p className="mt-1 font-mono text-xs text-neutral-500">{tenant.slug}</p>
        </div>
      </div>

      <Card title="Algemeen">
        <TenantEditForm
          tenant={{
            id: tenant.id,
            name: tenant.name,
            locale: tenant.locale,
            accentColor: tenant.accentColor,
            secondaryColor: tenant.secondaryColor,
            logoUrl: tenant.logoUrl,
            faviconUrl: tenant.faviconUrl,
            fontFamily: tenant.fontFamily,
          }}
        />
      </Card>

      <Card title="Huisstijl" description="Logo, kleuren, favicon en lettertype. Runtime toegepast per tenant.">
        <TenantBrandingForm
          tenant={{
            id: tenant.id,
            name: tenant.name,
            locale: tenant.locale,
            accentColor: tenant.accentColor,
            secondaryColor: tenant.secondaryColor,
            logoUrl: tenant.logoUrl,
            faviconUrl: tenant.faviconUrl,
            fontFamily: tenant.fontFamily,
          }}
        />
      </Card>

      <Card title="Status & verwijderen" description="Een inactieve tenant kan niet meer inloggen.">
        <div className="flex flex-wrap items-center gap-3">
          <form action={setTenantStatus}>
            <input type="hidden" name="id" value={tenant.id} />
            <input type="hidden" name="status" value={active ? "INACTIVE" : "ACTIVE"} />
            <button
              type="submit"
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
            >
              {active ? "Deactiveren" : "Activeren"}
            </button>
          </form>
          <ConfirmButton
            action={deleteTenant}
            fields={{ id: tenant.id }}
            label="Verwijderen (soft-delete)"
            triggerClassName="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            title={`${tenant.name} verwijderen?`}
            message="De tenant wordt gemarkeerd als verwijderd en gedeactiveerd. Gebruikers kunnen niet meer inloggen."
            confirmLabel="Verwijderen"
          />
        </div>
      </Card>

      <Card title="Gebruikers" description="Rollen wijzigen, accounts (de)activeren of verwijderen.">
        {users.length === 0 ? (
          <p className="text-sm text-neutral-500">Nog geen gebruikers.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-neutral-100">
            {users.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-3 py-3">
                <Avatar name={u.name ?? u.email} size="sm" status={u.active ? "online" : "offline"} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate font-medium text-neutral-900">
                    {u.name ?? u.email}
                    {!u.active ? <Badge tone="warning">gedeactiveerd</Badge> : null}
                  </p>
                  <p className="truncate text-xs text-neutral-500">{u.email}</p>
                </div>
                <form action={setMemberRole} className="flex items-center gap-1">
                  <input type="hidden" name="tenantId" value={tenant.id} />
                  <input type="hidden" name="userId" value={u.id} />
                  <select
                    name="role"
                    defaultValue={u.role}
                    className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
                  >
                    <option value="TENANT_ADMIN">{ROLE_LABEL.TENANT_ADMIN}</option>
                    <option value="TENANT_MEMBER">{ROLE_LABEL.TENANT_MEMBER}</option>
                  </select>
                  <button type="submit" className="rounded-lg border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-50">
                    Wijzig
                  </button>
                </form>
                <form action={setMemberActive}>
                  <input type="hidden" name="tenantId" value={tenant.id} />
                  <input type="hidden" name="userId" value={u.id} />
                  <input type="hidden" name="active" value={u.active ? "false" : "true"} />
                  <button type="submit" className="rounded-lg border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-50">
                    {u.active ? "Deactiveren" : "Activeren"}
                  </button>
                </form>
                <form action={deleteMember}>
                  <input type="hidden" name="tenantId" value={tenant.id} />
                  <input type="hidden" name="userId" value={u.id} />
                  <button type="submit" className="rounded-lg border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50">
                    Verwijder
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Uitnodigingen" description="Nodig een gebruiker uit per e-mail. De link verschijnt in de server-console (dev).">
        <form action={inviteToTenant} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="tenantId" value={tenant.id} />
          <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
            E-mail
            <input
              type="email"
              name="email"
              required
              placeholder="naam@voorbeeld.nl"
              className="w-64 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
            Rol
            <select name="role" defaultValue="TENANT_MEMBER" className="rounded-lg border border-neutral-300 px-3 py-2 text-sm">
              <option value="TENANT_MEMBER">{ROLE_LABEL.TENANT_MEMBER}</option>
              <option value="TENANT_ADMIN">{ROLE_LABEL.TENANT_ADMIN}</option>
            </select>
          </label>
          <button type="submit" className="rounded-lg bg-accent-gradient px-4 py-2 text-sm font-semibold text-accent-foreground shadow-sm hover:shadow-accent">
            Uitnodigen
          </button>
        </form>

        {invitations.length > 0 ? (
          <ul className="flex flex-col divide-y divide-neutral-100">
            {invitations.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="text-neutral-700">
                  {inv.email}{" "}
                  <span className="text-xs text-neutral-400">· {ROLE_LABEL[inv.role]}</span>
                </span>
                <form action={revokeInvitation}>
                  <input type="hidden" name="tenantId" value={tenant.id} />
                  <input type="hidden" name="invitationId" value={inv.id} />
                  <button type="submit" className="text-xs text-neutral-400 hover:text-red-600">
                    Intrekken
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>
    </div>
  );
}
