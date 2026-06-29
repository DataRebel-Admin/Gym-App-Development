import { LoginForm } from "./login-form";
import { getCurrentTenant, getTenantSlug } from "@/lib/tenant";

export default async function LoginPage() {
  // Tenant komt uit de proxy-header (subdomein of ?tenant), niet rechtstreeks
  // uit de query — zo werkt zowel productie (subdomein) als dev (?tenant).
  const slug = await getTenantSlug();
  const tenant = await getCurrentTenant();

  return (
    <main className="flex flex-1 items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="mb-3 inline-block h-3 w-3 rounded-full bg-accent" />
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
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
