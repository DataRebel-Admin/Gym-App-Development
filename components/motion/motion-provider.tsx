"use client";

import { LazyMotion, domAnimation, MotionConfig } from "motion/react";

/**
 * Wrapt de app in een Framer Motion-context.
 * - `LazyMotion` + `domAnimation` laadt alleen de DOM-animatiefeatures
 *   (kleinere bundel; gebruik overal `m.*` i.p.v. `motion.*`).
 * - `MotionConfig reducedMotion="user"` respecteert prefers-reduced-motion
 *   automatisch voor alle child-animaties.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domAnimation} strict>
        {children}
      </LazyMotion>
    </MotionConfig>
  );
}
