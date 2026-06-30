import { cn } from "@/lib/cn";

/**
 * Premium tabel-primitives: strakke randen, sticky header, hover-rij.
 * Wrap met <TableWrap> voor de kaart-omhulling + horizontale scroll.
 */
export function TableWrap({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "overflow-x-auto rounded-2xl border border-border bg-surface-1 shadow-sm",
        className
      )}
    >
      {children}
    </div>
  );
}

export function Table({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <table className={cn("w-full text-sm", className)}>{children}</table>;
}

export function Thead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="sticky top-0 bg-surface-2/90 text-left backdrop-blur">
      {children}
    </thead>
  );
}

export function Th({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <th
      className={cn(
        "px-4 py-3 text-xs font-semibold uppercase tracking-wide text-neutral-500",
        className
      )}
    >
      {children}
    </th>
  );
}

export function Tbody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-border">{children}</tbody>;
}

export function Tr({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <tr className={cn("transition-colors hover:bg-neutral-100/60", className)}>
      {children}
    </tr>
  );
}

export function Td({
  className,
  colSpan,
  children,
}: {
  className?: string;
  colSpan?: number;
  children?: React.ReactNode;
}) {
  return (
    <td colSpan={colSpan} className={cn("px-4 py-3 text-neutral-900", className)}>
      {children}
    </td>
  );
}
