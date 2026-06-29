import type { Variants, Transition } from "motion/react";

/** Standaard easing/duur, gelijk aan de CSS motion-tokens. */
export const easeOut: Transition["ease"] = [0.16, 1, 0.3, 1];
export const dur = 0.22;
export const durFast = 0.15;
export const durSlow = 0.32;

/** Fade + lichte slide-up — voor pagina-/sectie-onthulling. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: dur, ease: easeOut },
  },
};

/** Container die children gestaggerd onthult. */
export const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.06, delayChildren: 0.02 },
  },
};

/** Korte fade — voor route-transitions. */
export const fade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: durFast, ease: easeOut } },
  exit: { opacity: 0, transition: { duration: durFast } },
};

/** Schaal-pop voor overlays (modal/popover). */
export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: 8 },
  show: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: dur, ease: easeOut },
  },
  exit: {
    opacity: 0,
    scale: 0.97,
    y: 6,
    transition: { duration: durFast, ease: easeOut },
  },
};

/** Tap-/hover micro-interactie voor knoppen/kaarten. */
export const tap = { scale: 0.97 };
export const hoverLift = { y: -2 };
