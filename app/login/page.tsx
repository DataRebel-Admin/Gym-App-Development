import { LoginForm } from "./login-form";
import { getCurrentTenant, getTenantSlug } from "@/lib/tenant";
import { oauthEnabled } from "@/lib/oauth";
import { devLoginEnabled, DEMO_ACCOUNTS } from "@/lib/dev-login";
import { Reveal } from "@/components/motion/reveal";

export const metadata = { title: "Inloggen" };

const HIGHLIGHTS = [
  "Jouw schema, altijd bij de hand",
  "Scan een apparaat, zie direct de oefening",
  "Volg je voortgang per training",
];

export default async function LoginPage() {
  // Tenant komt uit de proxy-header (subdomein of ?tenant), niet rechtstreeks
  // uit de query — zo werkt zowel productie (subdomein) als dev (?tenant).
  const slug = await getTenantSlug();
  const tenant = await getCurrentTenant();
  const oauth = oauthEnabled();
  const devAccounts = devLoginEnabled() ? DEMO_ACCOUNTS : null;

  const name = tenant?.name ?? "GymRebel";
  const initial = name.charAt(0).toUpperCase();

  return (
    // Gecentreerd op de geanimeerde, gebrande pagina-achtergrond (--app-bg).
    <main className="flex flex-1 items-center justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:px-6 lg:px-8">
      <Reveal className="grid w-full max-w-sm overflow-hidden rounded-3xl border border-border bg-surface-1 shadow-lg lg:max-w-5xl lg:grid-cols-[1.05fr_1fr]">
        {/* Brand-paneel — whitelabel, gebruikt de tenant-accent. Desktop-only. */}
        <aside className="relative hidden overflow-hidden bg-accent-gradient text-accent-foreground lg:flex lg:min-h-[34rem] lg:flex-col lg:justify-between lg:p-12 xl:p-14">
          {/* Sfeer: zachte radialen + fijn raster over het verloop. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{
              backgroundImage:
                "radial-gradient(60% 50% at 15% 10%, rgb(255 255 255 / 0.22) 0%, transparent 60%), radial-gradient(50% 50% at 90% 90%, rgb(0 0 0 / 0.18) 0%, transparent 55%)",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.12]"
            style={{
              backgroundImage:
                "linear-gradient(rgb(255 255 255 / 0.6) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / 0.6) 1px, transparent 1px)",
              backgroundSize: "44px 44px",
              maskImage:
                "radial-gradient(120% 100% at 50% 0%, black 35%, transparent 80%)",
            }}
          />

          <div className="relative flex items-center gap-3">
            {tenant?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={tenant.logoUrl}
                alt=""
                className="h-11 w-11 rounded-2xl bg-white/15 object-contain p-1.5 ring-1 ring-white/25"
              />
            ) : (
              <span className="flex size-11 items-center justify-center rounded-2xl bg-white/15 text-lg font-bold ring-1 ring-white/25">
                {initial}
              </span>
            )}
            <span className="font-display text-lg font-semibold tracking-tight">
              {name}
            </span>
          </div>

          <div className="relative max-w-md">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-accent-foreground/70">
              Welkom terug
            </p>
            <h2 className="mt-4 font-display text-4xl font-bold leading-[1.1] tracking-tight xl:text-[2.75rem]">
              Train slimmer.
              <br />
              Houd je voortgang vast.
            </h2>
            <ul className="mt-10 space-y-4">
              {HIGHLIGHTS.map((line) => (
                <li key={line} className="flex items-center gap-3 text-sm font-medium">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25">
                    <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden>
                      <path
                        d="M3.5 8.5l3 3 6-6.5"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  {line}
                </li>
              ))}
            </ul>
          </div>

          <p className="relative text-xs text-accent-foreground/60">
            © {new Date().getFullYear()} {name}
          </p>
        </aside>

        {/* Form-kolom */}
        <div className="flex flex-col justify-center px-6 py-10 sm:px-10 sm:py-12">
          {/* Merk-koptekst — op mobiel zichtbaar (brand-paneel is desktop-only). */}
          <div className="mb-7 text-center sm:mb-8">
            {tenant?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={tenant.logoUrl}
                alt=""
                className="mx-auto mb-4 h-14 w-14 rounded-2xl object-contain shadow-sm lg:hidden"
              />
            ) : (
              <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-accent-gradient text-xl font-bold text-accent-foreground shadow-accent lg:hidden">
                {initial}
              </span>
            )}
            <h1 className="font-display text-2xl font-bold tracking-tight text-neutral-900">
              Inloggen
            </h1>
            <p className="mt-1.5 text-sm text-neutral-500">
              Welkom terug bij{" "}
              <span className="font-medium text-neutral-700">{name}</span>.
            </p>
          </div>

          <LoginForm tenant={slug} oauth={oauth} devAccounts={devAccounts} />

          {!tenant ? (
            <p className="mt-4 text-center text-xs text-neutral-500">
              Onbekende sportschool &ldquo;{slug}&rdquo;.
            </p>
          ) : null}
        </div>
      </Reveal>
    </main>
  );
}
