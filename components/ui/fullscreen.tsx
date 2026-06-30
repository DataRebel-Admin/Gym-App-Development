"use client";

import { createContext, useContext, useRef } from "react";
import { AnimatePresence, m } from "motion/react";
import { cn } from "@/lib/cn";
import { useToast } from "@/components/ui/toast";
import { useFullscreen, type UseFullscreen } from "@/lib/hooks/use-fullscreen";
import { Maximize, Minimize } from "@/components/ui/icons";

const FullscreenContext = createContext<UseFullscreen | null>(null);

/**
 * Wrapt een stuk pagina zodat het met één klik fullscreen kan. Houdt de ref,
 * draait `useFullscreen` en deelt de status via context met (één of meer)
 * `<FullscreenButton>`-instanties eronder. De browser toont in fullscreen
 * alléén deze subtree, waardoor header/navigatie vanzelf verdwijnen — pagina
 * en scrollpositie blijven behouden.
 *
 * De `fs-target`-klasse (zie globals.css) geeft de container in fullscreen de
 * app-achtergrond + scroll i.p.v. de zwarte browser-default.
 */
export function Fullscreenable({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const fs = useFullscreen(ref);

  return (
    <FullscreenContext.Provider value={fs}>
      <div
        ref={ref}
        data-fullscreen={fs.isFullscreen ? "" : undefined}
        className={cn("fs-target", className)}
      >
        {children}
      </div>
    </FullscreenContext.Provider>
  );
}

/**
 * Toggle-knop voor volledig scherm. Moet binnen een `<Fullscreenable>` staan.
 * Wisselt tussen "Volledig scherm" en "Volledig scherm verlaten", toont de
 * status visueel (icoon + `aria-pressed`), heeft een tooltip + `aria-label`,
 * en geeft een korte toast bij activeren. Verbergt zichzelf wanneer de browser
 * de Fullscreen API niet ondersteunt (bv. iOS Safari op iPhone).
 */
export function FullscreenButton({ className }: { className?: string }) {
  const ctx = useContext(FullscreenContext);
  const { toast, error } = useToast();

  if (!ctx || !ctx.isSupported) return null;

  const { isFullscreen, toggle } = ctx;
  const label = isFullscreen ? "Volledig scherm verlaten" : "Volledig scherm";

  async function onClick() {
    const wasFullscreen = isFullscreen;
    const ok = await toggle();
    if (!ok) {
      error("Volledig scherm is niet beschikbaar in deze weergave.");
    } else if (!wasFullscreen) {
      toast("Volledig scherm — druk op Esc om te verlaten.");
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={isFullscreen}
      className={cn(
        "relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-surface-1 text-neutral-700 transition-colors hover:text-neutral-900 focus-ring",
        className
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        <m.span
          key={isFullscreen ? "min" : "max"}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.6, opacity: 0 }}
          transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          className="absolute"
        >
          {isFullscreen ? (
            <Minimize className="size-[18px]" />
          ) : (
            <Maximize className="size-[18px]" />
          )}
        </m.span>
      </AnimatePresence>
    </button>
  );
}
