import { cn } from "@/lib/cn";

/** Shimmer-placeholder voor loading-states. */
export function Skeleton({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      className={cn(
        "shimmer rounded-lg bg-neutral-100",
        className
      )}
    />
  );
}
