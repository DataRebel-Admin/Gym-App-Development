"use client";

import { m } from "motion/react";
import { tap } from "@/components/motion/variants";
import {
  buttonClasses,
  type ButtonVariant,
  type ButtonSize,
} from "@/components/ui/button-classes";

export {
  buttonClasses,
  type ButtonVariant,
  type ButtonSize,
} from "@/components/ui/button-classes";

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className,
  children,
  disabled,
  ...props
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
} & Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "onAnimationStart" | "onAnimationEnd" | "onDrag" | "onDragStart" | "onDragEnd"
>) {
  return (
    <m.button
      whileTap={disabled || loading ? undefined : tap}
      className={buttonClasses({ variant, size, className })}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Spinner /> : null}
      {children}
    </m.button>
  );
}

function Spinner() {
  return (
    <span
      className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
      aria-hidden
    />
  );
}
