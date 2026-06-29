import { cn } from "@/lib/cn";

/** Lege-staat-blok met icoon/emoji, titel, beschrijving en optionele actie. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-surface-0 px-6 py-12 text-center",
        className
      )}
    >
      {icon ? <div className="text-3xl">{icon}</div> : null}
      <p className="font-semibold text-neutral-900">{title}</p>
      {description ? (
        <p className="max-w-sm text-sm text-neutral-500">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
