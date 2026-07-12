import Link from "next/link";

/**
 * Gedeelde kaart-shell voor de wachtwoord-reset-pagina's (aanvraag, check,
 * token). Presentational en whitelabel: toont het tenant-logo/-initiaal, een
 * titel + subtitel en een "terug naar inloggen"-link. Gebruikt de accent-tokens
 * zodat de kaart per tenant meekleurt (zoals de 2FA-pagina).
 */
export function ResetShell({
  logoUrl,
  name,
  title,
  subtitle,
  backLabel,
  children,
}: {
  logoUrl?: string | null;
  name: string;
  title: string;
  subtitle: string;
  backLabel: string;
  children: React.ReactNode;
}) {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-surface-1 p-8 shadow-md">
        <div className="mb-8 text-center">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt=""
              className="mx-auto mb-4 h-12 w-12 rounded-xl object-contain"
            />
          ) : (
            <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-accent-gradient text-lg font-bold text-accent-foreground shadow-accent">
              {name.charAt(0).toUpperCase()}
            </span>
          )}
          <h1 className="font-display text-2xl font-bold tracking-tight text-neutral-900">
            {title}
          </h1>
          <p className="mt-1.5 text-sm text-neutral-500">{subtitle}</p>
        </div>

        {children}

        <p className="mt-6 text-center text-xs text-neutral-500">
          <Link href="/login" className="font-medium hover:text-neutral-900">
            {backLabel}
          </Link>
        </p>
      </div>
    </main>
  );
}
