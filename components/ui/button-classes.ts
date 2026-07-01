import { cn } from "@/lib/cn";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl font-semibold transition-colors focus-ring disabled:pointer-events-none disabled:opacity-50 select-none";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-accent-gradient text-accent-foreground shadow-sm hover:shadow-accent",
  // Inverteert per thema (donker-op-licht / licht-op-donker) → altijd contrastrijk.
  secondary: "bg-foreground text-background hover:opacity-90",
  outline:
    "border border-border-strong bg-surface-1 text-neutral-900 hover:bg-neutral-100",
  ghost: "text-neutral-700 hover:bg-neutral-100",
  danger: "bg-red-600 text-white hover:bg-red-700",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

/** Gedeelde knop-klassen — ook bruikbaar voor <Link>-CTA's en server components. */
export function buttonClasses(opts?: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  const { variant = "primary", size = "md", className } = opts ?? {};
  return cn(base, variants[variant], sizes[size], className);
}
