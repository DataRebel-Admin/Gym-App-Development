"use client";

import { useEffect, useRef } from "react";

/**
 * Levende aurora-achtergrond: vier onafhankelijk zwevende, tenant-getinte orbs.
 *
 * Puur decoratief (aria-hidden). De autonome zweefbeweging zit volledig in CSS
 * (zie `.app-bg` in globals.css) en wordt onder `prefers-reduced-motion` globaal
 * gestopt. Whitelabel: de orbs kleuren runtime mee met de tenant-accentkleuren.
 *
 * Elk orb zit in een eigen laag-wrapper (`.app-bg__layer`). Op **desktop/laptop
 * met een muis** reageren die lagen op de cursor: een parallax waarbij elke laag
 * naar rato van zijn eigen diepte (`--depth`) meebeweegt. Deze controller zet
 * daarvoor de genormaliseerde muispositie (`--px`/`--py`, bereik ~[-1, 1]) op de
 * container; de CSS-transition op de lagen verzorgt de zachte na-ijl. Op touch/
 * geen-muis worden die vars nooit gezet → 0 → geen parallax. Muis-parallax is
 * directe manipulatie (geen autonome animatie), dus die blijft óók werken onder
 * reduced-motion — alleen de autonome zweef stopt dan.
 *
 * Eén keer gemount als eerste kind van <body> in de root-layout, achter alle
 * content (negatieve z-index).
 */
export function AppBackground() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Alleen op een apparaat mét muis (desktop/laptop, ook hybride). We gebruiken
    // any-hover/any-pointer i.p.v. het PRIMAIRE pointer-type, zodat een laptop met
    // touchscreen (waar het primaire type "coarse" kan zijn) tóch meedoet. Een
    // touch-only telefoon/tablet heeft geen fijne aanwijzer → geen parallax.
    if (
      !window.matchMedia("(any-hover: hover) and (any-pointer: fine)").matches
    ) {
      return;
    }

    let raf = 0;
    let nx = 0;
    let ny = 0;

    const apply = () => {
      raf = 0;
      el.style.setProperty("--px", nx.toFixed(4));
      el.style.setProperty("--py", ny.toFixed(4));
    };

    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };

    const onMove = (e: MouseEvent) => {
      // Offset t.o.v. het schermmidden, genormaliseerd naar ~[-1, 1]. rAF
      // coalesceert meerdere events per frame → maximaal één update per frame.
      nx = (e.clientX / window.innerWidth - 0.5) * 2;
      ny = (e.clientY / window.innerHeight - 0.5) * 2;
      schedule();
    };

    const onLeave = () => {
      // Cursor verlaat het venster → rustig terug naar het midden.
      nx = 0;
      ny = 0;
      schedule();
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    document.addEventListener("mouseleave", onLeave);

    return () => {
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="app-bg" aria-hidden ref={ref}>
      <div className="app-bg__layer app-bg__layer--1">
        <span className="app-bg__orb app-bg__orb--1" />
      </div>
      <div className="app-bg__layer app-bg__layer--2">
        <span className="app-bg__orb app-bg__orb--2" />
      </div>
      <div className="app-bg__layer app-bg__layer--3">
        <span className="app-bg__orb app-bg__orb--3" />
      </div>
      <div className="app-bg__layer app-bg__layer--4">
        <span className="app-bg__orb app-bg__orb--4" />
      </div>
    </div>
  );
}
