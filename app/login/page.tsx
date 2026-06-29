import { LoginForm } from "./login-form";
import { DEV_FALLBACK_TENANT } from "@/lib/constants";
import { prisma } from "@/lib/db";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string }>;
}) {
  const { tenant: tenantParam } = await searchParams;
  const slug = tenantParam ?? DEV_FALLBACK_TENANT;

  // Toon de tenant-naam als die bestaat (puur informatief op de loginpagina).
  const tenant = await prisma.tenant.findUnique({ where: { slug } });

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
