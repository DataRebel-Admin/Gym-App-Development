"use client";

import { usePathname } from "next/navigation";
import { m } from "motion/react";
import { fadeUp } from "./variants";

/**
 * Onthult route-content met een korte fade/slide bij elke paginawissel.
 * Gekeyed op het pathname zodat de animatie opnieuw speelt na navigatie.
 * Reduced-motion wordt afgehandeld door MotionConfig in MotionProvider.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <m.div
      key={pathname}
      variants={fadeUp}
      initial="hidden"
      animate="show"
      className="flex flex-1 flex-col"
    >
      {children}
    </m.div>
  );
}
