import { cn } from "@/lib/cn";

const sizes = {
  sm: "size-7 text-xs",
  md: "size-9 text-sm",
  lg: "size-12 text-base",
};

/** Avatar met initiaal op accent-gradient + optionele status-dot. */
export function Avatar({
  name,
  src,
  size = "md",
  status,
  className,
}: {
  name?: string | null;
  src?: string | null;
  size?: keyof typeof sizes;
  status?: "online" | "offline";
  className?: string;
}) {
  const initial = (name?.trim()?.charAt(0) ?? "?").toUpperCase();
  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          className={cn("rounded-full object-cover", sizes[size])}
        />
      ) : (
        <span
          className={cn(
            "flex items-center justify-center rounded-full bg-accent-gradient font-bold text-accent-foreground",
            sizes[size]
          )}
        >
          {initial}
        </span>
      )}
      {status ? (
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-surface-1",
            status === "online" ? "bg-green-500" : "bg-neutral-400"
          )}
        />
      ) : null}
    </span>
  );
}
