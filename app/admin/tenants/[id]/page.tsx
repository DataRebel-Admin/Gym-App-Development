import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSuperadmin } from "@/lib/superadmin";
import { setTenantStatus, deleteTenant } from "../actions";
import { TenantEditForm, TenantBrandingForm } from "./tenant-edit-forms";

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
    <section className="flex flex-col gap-4 rounded-xl border border-neutral-200 p-5">
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

  const active = tenant.status === "ACTIVE";

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/tenants" className="text-sm text-neutral-500 hover:text-neutral-900">
            ← Tenants
          </Link>
          <h1 className="mt-2 flex items-center gap-3 text-2xl font-semibold tracking-tight text-neutral-900">
            {tenant.name}
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                active ? "bg-green-100 text-green-700" : "bg-neutral-200 text-neutral-600"
              }`}
            >
              {active ? "Actief" : "Inactief"}
            </span>
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
          <form action={deleteTenant}>
            <input type="hidden" name="id" value={tenant.id} />
            <button
              type="submit"
              className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Verwijderen (soft-delete)
            </button>
          </form>
        </div>
      </Card>
    </div>
  );
}
