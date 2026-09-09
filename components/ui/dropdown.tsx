"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { cn } from "@/lib/cn";

/** Opties voor `close()`: bij een navigatie laten we de history-entry staan. */
export type DropdownCloseOptions = { keepHistory?: boolean };

/**
 * Eenvoudige dropdown/popover: trigger + paneel met fade/scale-animatie.
 * Sluit bij klik buiten of Escape. Voor menu's (user-menu, acties).
 *
 * `closeOnBack` maakt de terug-knop (browser én de Android-hardwareknop in de
 * native app) een sluitknop: zolang het paneel open is staat er een extra
 * history-entry, en `popstate` sluit het paneel in plaats van weg te navigeren.
 * Sluit de gebruiker het paneel zelf, dan halen we die entry weer weg — anders
 * zou terug een keer "niets" doen. Ga je vanuit het paneel navigeren, geef dan
 * `close({ keepHistory: true })`: een `history.back()` zou daar met de
 * navigatie vechten, en de achterblijvende entry wijst naar dezelfde pagina en
 * is dus onschadelijk. Bewust opt-in: menu's waarvan de items direct navigeren
 * hebben er niets aan.
 */
export function Dropdown({
  trigger,
  children,
  align = "end",
  className,
  closeOnBack = false,
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => React.ReactNode;
  children: (props: { close: (options?: DropdownCloseOptions) => void }) => React.ReactNode;
  align?: "start" | "end";
  className?: string;
  closeOnBack?: boolean;
}) {
  const [open, setOpen] = useState(false);
  // Wrapper (trigger + paneel), zodat een klik op de trigger niet "buiten" is.
  const ref = useRef<HTMLDivElement>(null);

  /**
   * Sluiten vanuit de UI. Staat onze history-entry er nog, dan halen we die er
   * met een `back()` weer af; de popstate die daarop volgt vindt het paneel al
   * gesloten.
   */
  const close = useCallback(
    (options?: DropdownCloseOptions) => {
      if (open && closeOnBack && !options?.keepHistory) window.history.back();
      setOpen(false);
    },
    [open, closeOnBack]
  );

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  // Zolang het paneel open is staat er een history-entry die de terug-knop
  // opeet in plaats van de pagina.
  useEffect(() => {
    if (!open || !closeOnBack) return;
    window.history.pushState({ ...window.history.state, gymrebelOverlay: true }, "");
    const onPop = () => setOpen(false);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [open, closeOnBack]);

  return (
    <div ref={ref} className="relative">
      {trigger({ open, toggle: () => (open ? close() : setOpen(true)) })}
      <AnimatePresence>
        {open ? (
          <m.div
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -4 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              "absolute z-50 mt-2 min-w-44 overflow-hidden rounded-xl border border-border bg-surface-2 p-1 shadow-lg",
              align === "end" ? "right-0" : "left-0",
              className
            )}
          >
            {children({ close })}
          </m.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/** Klikbaar item binnen een Dropdown-paneel. */
export function DropdownItem({
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-neutral-700 transition-colors hover:bg-neutral-100",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
