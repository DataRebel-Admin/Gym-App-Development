import { LoginForm } from "./login-form";
import { getCurrentTenant, getTenantSlug } from "@/lib/tenant";

export default async function LoginPage() {
  // Tenant komt uit de proxy-header (subdomein of ?tenant), niet rechtstreeks
  // uit de query — zo werkt zowel productie (subdomein) als dev (?tenant).
  const slug = await getTenantSlug();
  const tenant = await getCurrentTenant();

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-surface-1 p-8 shadow-md">
        <div className="mb-8 text-center">
          {tenant?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tenant.logoUrl}
              alt=""
              className="mx-auto mb-4 h-12 w-12 rounded-xl object-contain"
            />
          ) : (
            <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-accent-gradient text-lg font-bold text-accent-foreground shadow-accent">
              {(tenant?.name ?? "G").charAt(0)}
            </span>
          )}
          <h1 className="font-display text-2xl font-bold tracking-tight text-neutral-900">
            {tenant?.name ?? "GymRebel"}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Log in met je e-mailadres.
          </p>
        </div>

        <LoginForm tenant={slug} />

        {!tenant ? (
          <p className="mt-4 text-center text-xs text-neutral-500">
            Onbekende sportschool &quot;{slug}&quot;.
          </p>
        ) : null}
      </div>
    </main>
  );
}
