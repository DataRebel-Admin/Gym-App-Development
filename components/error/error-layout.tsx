"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { m } from "motion/react";
import { useTenant } from "@/components/tenant-provider";
import { buttonClasses } from "@/components/ui/button-classes";
import { ChevronLeft, RotateCcw, LayoutDashboard, LogOut } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { ERROR_PRESETS, type ErrorCode, type ErrorNav } from "@/lib/errors";
import { ErrorIllustration } from "./error-illustration";

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};
const item = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.32, ease: [0.16, 1, 0.3, 1] as const },
  },
};

/**
 * Herbruikbare premium foutpagina-shell. Alle foutpagina's (404/500/403/401/503)
 * delen deze layout zodat een gebruiker nooit een kale framework-fout ziet.
 * Leest de tenant-huisstijl uit `useTenant()` en behoudt de `?tenant=`-context
 * (dev) op alle interne links. `reset` activeert de "Probeer opnieuw"-knop (5xx).
 */
export function ErrorLayout({
  code,
  nav,
  reset,
  children,
}: {
  code: ErrorCode;
  nav: ErrorNav;
  reset?: () => void;
  /** Extra inhoud onder de acties (bijv. route-suggesties op de 404). */
  children?: React.ReactNode;
}) {
  const preset = ERROR_PRESETS[code];
  const tenant = useTenant();
  const router = useRouter();

  // Behoud tenantcontext in dev (?tenant=slug); no-op in productie (subdomein).
  const [tenantQuery, setTenantQuery] = useState("");
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tenant");
    setTenantQuery(t ? `?tenant=${encodeURIComponent(t)}` : "");
  }, []);
  const withTenant = (href: string) => `${href}${tenantQuery}`;

  // Primaire actie: 5xx → opnieuw proberen; ingelogd → dashboard; anders inloggen.
  const showRetry = Boolean(preset.actions.retry && reset);
  // Primair "doel" dat we niet als secundaire knop willen herhalen.
  const primaryHref = showRetry
    ? null
    : nav.isAuthed
      ? nav.dashboardHref
      : nav.loginHref;

  // Secundaire bestemmingen, zonder de primaire te dupliceren.
  const secondary: { href: string; label: string }[] = [];
  if (nav.isAuthed && nav.dashboardHref !== primaryHref) {
    secondary.push({ href: nav.dashboardHref, label: nav.dashboardLabel });
  }
  if (nav.homeHref !== primaryHref) {
    secondary.push({ href: nav.homeHref, label: "Naar home" });
  }
  // Inloggen alleen aanbieden op auth-/navigatie-fouten (niet op transiënte 5xx).
  const loginRelevant = code === 401 || code === 403 || code === 404;
  if (!nav.isAuthed && loginRelevant && nav.loginHref !== primaryHref) {
    secondary.push({ href: nav.loginHref, label: "Inloggen" });
  }

  return (
    <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 py-16 text-center">
      {/* Zachte accent-gloed op de achtergrond (zoals de homepage). */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 size-[40rem] -translate-x-1/2 rounded-full opacity-[0.18] blur-3xl"
        style={{ background: "var(--accent-gradient)" }}
      />

      <m.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="relative flex w-full max-w-xl flex-col items-center"
      >
        {/* Tenant-logo / wordmark */}
        <m.div variants={item} className="mb-8 flex items-center gap-2.5">
          {tenant?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tenant.logoUrl}
              alt={tenant.name}
              className="h-8 w-8 rounded-lg object-contain"
            />
          ) : (
            <span className="flex size-8 items-center justify-center rounded-lg bg-accent-gradient text-sm font-bold text-accent-foreground shadow-accent">
              {(tenant?.name ?? "G").charAt(0)}
            </span>
          )}
          <span className="font-display text-lg font-semibold tracking-tight text-neutral-900">
            {tenant?.name ?? "GymRebel"}
          </span>
        </m.div>

        {/* Illustratie */}
        <m.div variants={item}>
          <ErrorIllustration code={code} />
        </m.div>

        {/* Statuscijfer + kicker */}
        <m.div variants={item} className="mt-6 flex flex-col items-center gap-3">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
              preset.tone === "danger"
                ? "border-red-500/30 bg-red-500/10 text-red-500"
                : preset.tone === "warning"
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  : "border-border bg-surface-1 text-neutral-500"
            )}
          >
            <span
              aria-hidden
              className={cn(
                "size-1.5 rounded-full",
                preset.tone === "danger"
                  ? "bg-red-500"
                  : preset.tone === "warning"
                    ? "bg-amber-500"
                    : "bg-accent"
              )}
            />
            Fout {code} · {preset.kicker}
          </span>
          <span
            aria-hidden
            className="font-display text-7xl font-bold leading-none text-accent-gradient sm:text-8xl"
          >
            {code}
          </span>
        </m.div>

        {/* Titel + uitleg */}
        <m.h1
          variants={item}
          className="mt-6 font-display text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl"
        >
          {preset.title}
        </m.h1>
        <m.p
          variants={item}
          className="mt-3 max-w-md text-balance text-base leading-relaxed text-neutral-500"
        >
          {preset.description}
        </m.p>

        {/* Acties */}
        <m.div
          variants={item}
          className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:flex-wrap sm:justify-center"
        >
          {showRetry ? (
            <button
              type="button"
              onClick={reset}
              className={cn(
                buttonClasses({ variant: "primary", size: "lg" }),
                "shadow-accent transition-transform hover:-translate-y-0.5"
              )}
            >
              <RotateCcw className="size-4" />
              Probeer opnieuw
            </button>
          ) : nav.isAuthed ? (
            <Link
              href={withTenant(nav.dashboardHref)}
              className={cn(
                buttonClasses({ variant: "primary", size: "lg" }),
                "shadow-accent transition-transform hover:-translate-y-0.5"
              )}
            >
              <LayoutDashboard className="size-4" />
              {nav.dashboardLabel}
            </Link>
          ) : (
            <Link
              href={withTenant(nav.loginHref)}
              className={cn(
                buttonClasses({ variant: "primary", size: "lg" }),
                "shadow-accent transition-transform hover:-translate-y-0.5"
              )}
            >
              <LogOut className="size-4 rotate-180" />
              Inloggen
            </Link>
          )}

          {/* Secundaire bestemmingen */}
          {secondary.map((s) => (
            <Link
              key={s.href}
              href={withTenant(s.href)}
              className={cn(
                buttonClasses({ variant: "outline", size: "lg" }),
                "transition-transform hover:-translate-y-0.5"
              )}
            >
              {s.label}
            </Link>
          ))}

          {/* Ga terug */}
          {preset.actions.back ? (
            <button
              type="button"
              onClick={() => router.back()}
              className={cn(
                buttonClasses({ variant: "ghost", size: "lg" }),
                "transition-transform hover:-translate-y-0.5"
              )}
            >
              <ChevronLeft className="size-4" />
              Ga terug
            </button>
          ) : null}
        </m.div>

        {/* Optionele extra inhoud (404-suggesties/zoek) */}
        {children ? (
          <m.div variants={item} className="mt-10 w-full">
            {children}
          </m.div>
        ) : null}
      </m.div>
    </main>
  );
}
