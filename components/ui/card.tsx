import { cn } from "@/lib/cn";

export type CardVariant = "default" | "elevated" | "glass" | "interactive";

const cardVariants: Record<CardVariant, string> = {
  default: "border border-border bg-surface-1 shadow-sm",
  elevated: "border border-border bg-surface-1 shadow-md",
  glass: "border border-border/70 glass shadow-md",
  interactive:
    "border border-border bg-surface-1 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:border-border-strong",
};

/**
 * Basale kaart-primitief. Server-compatibel (geen client-JS).
 * `variant`: default | elevated | glass | interactive (hover-lift).
 */
export function Card({
  className,
  variant = "default",
  children,
  ...props
}: { variant?: CardVariant } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-2xl", cardVariants[variant], className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-col gap-1 px-5 pt-5", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        "text-sm font-semibold tracking-tight text-neutral-900",
        className
      )}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardContent({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("p-5", className)} {...props}>
      {children}
    </div>
  );
}
