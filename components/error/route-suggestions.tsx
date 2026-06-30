"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { m } from "motion/react";
import { Search, ArrowUpRight, ChevronRight, X } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import {
  routesForRole,
  suggestRoutes,
  isHighConfidence,
  type DashRole,
} from "@/lib/errors";

const AUTO_REDIRECT_SECONDS = 4;

/**
 * Slimme 404-hulp: detecteert typo's in de URL en stelt een vergelijkbare
 * bekende pagina voor. Bij een zeer waarschijnlijke match navigeert hij — na een
 * zichtbare countdown met annuleerknop — automatisch. Daaronder een zoek/filter
 * over de bekende pagina's voor de rol. Tenantcontext (?tenant=) blijft behouden.
 */
export function RouteSuggestions({ role }: { role: DashRole | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("errors.suggestions");

  const [tenantQuery, setTenantQuery] = useState("");
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tenant");
    setTenantQuery(t ? `?tenant=${encodeURIComponent(t)}` : "");
  }, []);
  const withTenant = (href: string) => `${href}${tenantQuery}`;

  const suggestions = useMemo(
    () => suggestRoutes(pathname, role),
    [pathname, role]
  );
  const best = suggestions[0];
  const highConfidence = useMemo(
    () => isHighConfidence(best, pathname),
    [best, pathname]
  );

  // Auto-redirect-countdown (alleen bij hoge zekerheid; annuleerbaar).
  const [cancelled, setCancelled] = useState(false);
  const [seconds, setSeconds] = useState(AUTO_REDIRECT_SECONDS);
  const autoActive = highConfidence && !cancelled && Boolean(best);

  useEffect(() => {
    if (!autoActive || !best) return;
    if (seconds <= 0) {
      router.replace(withTenant(best.route.href));
      return;
    }
    const id = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoActive, seconds, best]);

  // Zoek/filter over bekende pagina's voor deze rol.
  const [query, setQuery] = useState("");
  const pool = useMemo(() => routesForRole(role), [role]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pool.slice(0, 6);
    return pool.filter(
      (r) =>
        r.label.toLowerCase().includes(q) || r.href.toLowerCase().includes(q)
    );
  }, [pool, query]);

  function cancelAuto() {
    setCancelled(true);
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border border-border bg-surface-1 p-5 text-left shadow-sm">
      {/* Hoge-zekerheid typo → auto-redirect-banner */}
      {autoActive && best ? (
        <m.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 rounded-xl border border-accent/30 bg-accent-soft p-3"
        >
          <p className="text-sm text-neutral-700">
            {t.rich("didYouMean", {
              label: best.route.label,
              b: (c) => (
                <span className="font-semibold text-neutral-900">{c}</span>
              ),
            })}
          </p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-xs text-neutral-500">
              {t("redirectingIn", { seconds })}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={cancelAuto}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-neutral-500 hover:bg-neutral-100"
              >
                <X className="size-3.5" />
                {t("cancel")}
              </button>
              <Link
                href={withTenant(best.route.href)}
                className="inline-flex items-center gap-1 rounded-lg bg-accent-gradient px-2.5 py-1 text-xs font-semibold text-accent-foreground"
              >
                {t("goNow")}
                <ArrowUpRight className="size-3.5" />
              </Link>
            </div>
          </div>
          {/* Voortgangsbalk */}
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-neutral-100">
            <m.div
              className="h-full rounded-full bg-accent-gradient"
              initial={false}
              animate={{ width: `${(seconds / AUTO_REDIRECT_SECONDS) * 100}%` }}
              transition={{ duration: 1, ease: "linear" }}
            />
          </div>
        </m.div>
      ) : best && !highConfidence ? (
        // Lagere zekerheid → suggestie zonder auto-navigatie
        <Link
          href={withTenant(best.route.href)}
          className="mb-4 flex items-center justify-between gap-2 rounded-xl border border-border bg-surface-0 p-3 transition-colors hover:border-border-strong"
        >
          <span className="text-sm text-neutral-700">
            {t.rich("didYouMean", {
              label: best.route.label,
              b: (c) => (
                <span className="font-semibold text-neutral-900">{c}</span>
              ),
            })}
          </span>
          <ChevronRight className="size-4 shrink-0 text-neutral-400" />
        </Link>
      ) : null}

      {/* Zoek */}
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!cancelled) setCancelled(true); // typen = handmatige intentie
          }}
          placeholder={t("searchPlaceholder")}
          className="h-10 w-full rounded-xl border border-border bg-surface-0 pl-9 pr-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus-ring"
          aria-label={t("searchAria")}
        />
      </label>

      {/* Quick links / zoekresultaten */}
      <p className="mt-4 mb-2 text-xs font-medium uppercase tracking-wide text-neutral-400">
        {query.trim() ? t("results") : t("popularPages")}
      </p>
      {filtered.length > 0 ? (
        <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {filtered.map((r) => (
            <li key={r.href}>
              <Link
                href={withTenant(r.href)}
                className={cn(
                  "group flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm text-neutral-700",
                  "transition-colors hover:bg-neutral-100 hover:text-neutral-900"
                )}
              >
                {r.label}
                <ArrowUpRight className="size-3.5 text-neutral-400 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-1 py-2 text-sm text-neutral-500">
          {t("noPageFound", { query: query.trim() })}
        </p>
      )}
    </div>
  );
}
