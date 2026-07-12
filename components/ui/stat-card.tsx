"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useInView, useReducedMotion } from "motion/react";
import { cn } from "@/lib/cn";

/** Referentiegrootte (px) waarop de verborgen meet-span de eindwaarde meet. */
const REF_FONT_PX = 30; // = text-3xl

/**
 * SSR-veilige startgrootte op basis van het aantal tekens, zodat de eerste
 * paint al dicht bij de uiteindelijke (gemeten) grootte zit — geen grote sprong.
 */
function initialFontPx(value: number) {
  const len = Math.abs(value).toLocaleString("nl-NL").length;
  if (len <= 4) return REF_FONT_PX;
  if (len === 5) return 26;
  if (len === 6) return 22;
  return 18;
}

/**
 * KPI-kaart met geanimeerd oplopend getal. Telt op zodra de kaart in beeld
 * komt; respecteert prefers-reduced-motion (toont dan direct de eindwaarde).
 *
 * Het getal schaalt automatisch mee met de kaartbreedte: op smalle kaarten
 * (bijv. de 3-koloms member-stats op mobiel) krimpt een groot getal zodat het
 * altijd binnen de kaart past i.p.v. eroverheen te lopen. De eenheid staat op
 * een eigen regel eronder en concurreert dus niet om de breedte van het getal.
 */
export function StatCard({
  label,
  value,
  suffix,
  icon,
  hint,
  trend,
  className,
}: {
  label: string;
  value: number;
  suffix?: string;
  icon?: React.ReactNode;
  hint?: string;
  /** ±% t.o.v. vorige periode; toont een gekleurde trend-pill. */
  trend?: number | null;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const numRef = useRef<HTMLSpanElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(reduced ? value : 0);
  const [fontPx, setFontPx] = useState(() => initialFontPx(value));

  useEffect(() => {
    if (!inView) return;
    if (reduced) {
      setDisplay(value);
      return;
    }
    const controls = animate(0, value, {
      duration: 0.9,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [inView, value, reduced]);

  // Meet de eindwaarde (via een verborgen span op referentiegrootte) af tegen de
  // beschikbare breedte en schaal de fontgrootte zo dat het getal past. tabular-nums
  // houdt elke cijferbreedte gelijk, dus de tel-animatie loopt nooit alsnog over.
  useEffect(() => {
    const row = numRef.current?.parentElement;
    const gauge = measureRef.current;
    if (!row || !gauge) return;
    const fit = () => {
      const available = row.clientWidth;
      const natural = gauge.scrollWidth;
      if (!available || !natural) return;
      const next =
        natural > available
          ? Math.max(15, Math.floor((available / natural) * REF_FONT_PX))
          : REF_FONT_PX;
      setFontPx(next);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(row);
    return () => ro.disconnect();
  }, [value]);

  return (
    <div
      ref={ref}
      className={cn(
        "panel-sheen relative flex flex-col gap-2 overflow-hidden rounded-2xl border border-border bg-surface-1 p-5 shadow-sm",
        className
      )}
    >
      {/* Zachte tenant-accent gloed achter de KPI — subtiele diepte. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-12 size-32 rounded-full bg-accent-soft blur-2xl"
      />
      <div className="relative flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
          {label}
        </span>
        {icon ? (
          <span className="flex size-8 items-center justify-center rounded-lg bg-accent-soft text-accent">
            {icon}
          </span>
        ) : null}
      </div>
      <div className="relative min-w-0">
        <span
          ref={numRef}
          className="block font-display font-bold leading-none tabular-nums text-neutral-900"
          style={{ fontSize: fontPx }}
        >
          {display.toLocaleString("nl-NL")}
        </span>
        {/* Verborgen referentie op vaste grootte — enkel om de eindbreedte te meten. */}
        <span
          ref={measureRef}
          aria-hidden
          className="pointer-events-none invisible absolute left-0 top-0 whitespace-nowrap font-display font-bold tabular-nums"
          style={{ fontSize: REF_FONT_PX }}
        >
          {value.toLocaleString("nl-NL")}
        </span>
        {suffix ? (
          <span className="mt-0.5 block text-sm font-semibold text-neutral-400">
            {suffix.trim()}
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        {trend != null ? (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold",
              trend > 0
                ? "bg-green-500/15 text-green-600"
                : trend < 0
                  ? "bg-red-500/15 text-red-600"
                  : "bg-neutral-100 text-neutral-500"
            )}
          >
            {trend > 0 ? "▲" : trend < 0 ? "▼" : "—"}
            {Math.abs(trend)}%
          </span>
        ) : null}
        {hint ? <span className="text-xs text-neutral-500">{hint}</span> : null}
      </div>
    </div>
  );
}
