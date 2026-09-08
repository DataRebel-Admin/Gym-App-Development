"use client";

import { useRef } from "react";
import { cn } from "@/lib/cn";

/**
 * Horizontaal scrollcontainer zonder zichtbare scrollbalk (.no-scrollbar in
 * globals.css), mét sleepondersteuning voor de muis. Touch scrollt native;
 * de pointer-logica draait alleen voor `pointerType === "mouse"`.
 *
 * Details die het "gewoon goed" laten voelen:
 * - tijdens het slepen staat scroll-snap tijdelijk uit (anders vecht
 *   snap-mandatory met elke scrollLeft-update en stottert de beweging);
 * - een sleep die echt bewogen heeft onderdrukt de daaropvolgende click,
 *   zodat je geen link activeert door 'm los te laten boven een item.
 */
export function DragScroll({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, moved: false, startX: 0, startLeft: 0 });

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    const el = ref.current;
    if (!el) return;
    drag.current = { active: true, moved: false, startX: e.clientX, startLeft: el.scrollLeft };
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el || !drag.current.active) return;
    const dx = e.clientX - drag.current.startX;
    if (!drag.current.moved && Math.abs(dx) > 4) {
      drag.current.moved = true;
      el.setPointerCapture(e.pointerId);
      el.style.scrollSnapType = "none";
    }
    if (drag.current.moved) el.scrollLeft = drag.current.startLeft - dx;
  }

  function endDrag() {
    const el = ref.current;
    if (el) el.style.scrollSnapType = "";
    drag.current.active = false;
    // `moved` blijft staan tot de click-capture 'm leest (die vuurt ná pointerup).
  }

  function onClickCapture(e: React.MouseEvent<HTMLDivElement>) {
    if (drag.current.moved) {
      e.preventDefault();
      e.stopPropagation();
      drag.current.moved = false;
    }
  }

  return (
    <div
      ref={ref}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerLeave={endDrag}
      onClickCapture={onClickCapture}
      className={cn(
        "no-scrollbar select-none overflow-x-auto cursor-grab active:cursor-grabbing",
        className
      )}
    >
      {children}
    </div>
  );
}
