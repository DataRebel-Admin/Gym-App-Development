"use client";

import { useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { Sun, Moon } from "lucide-react";
import { useClientValue } from "@/lib/hooks/use-client-value";

const COOKIE = "gymrebel-theme";

function readTheme(): "light" | "dark" {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

/**
 * Wisselt licht/donker. Zet `data-theme` op <html> én een cookie (1 jaar) zodat
 * de server de voorkeur de volgende keer no-flash kan toepassen.
 */
export function ThemeToggle({ className }: { className?: string }) {
  // Initieel uit <html data-theme> (server-side gezet); daarna wint de toggle.
  const initialTheme = useClientValue(readTheme, "dark");
  const [override, setOverride] = useState<"light" | "dark" | null>(null);
  const theme = override ?? initialTheme;

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    document.cookie = `${COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    setOverride(next);
  }

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Schakel naar licht thema" : "Schakel naar donker thema"}
      className={
        "relative flex size-9 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-border bg-surface-1 text-neutral-700 transition-colors hover:text-neutral-900 focus-ring " +
        (className ?? "")
      }
    >
      <AnimatePresence mode="wait" initial={false}>
        <m.span
          key={isDark ? "moon" : "sun"}
          initial={{ y: 12, opacity: 0, rotate: -30 }}
          animate={{ y: 0, opacity: 1, rotate: 0 }}
          exit={{ y: -12, opacity: 0, rotate: 30 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="absolute"
        >
          {isDark ? <Moon className="size-[18px]" /> : <Sun className="size-[18px]" />}
        </m.span>
      </AnimatePresence>
    </button>
  );
}
