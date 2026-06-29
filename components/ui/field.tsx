import { cn } from "@/lib/cn";

const control =
  "w-full rounded-xl border border-border bg-surface-1 px-3.5 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none transition-shadow focus-ring focus:border-accent disabled:opacity-50";

/** Label-wrapper voor een veld (label boven control). */
export function Field({
  label,
  hint,
  error,
  required,
  className,
  children,
}: {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      {label ? (
        <span className="text-sm font-medium text-neutral-700">
          {label}
          {required ? <span className="text-accent"> *</span> : null}
        </span>
      ) : null}
      {children}
      {error ? (
        <span className="text-xs text-red-600">{error}</span>
      ) : hint ? (
        <span className="text-xs text-neutral-500">{hint}</span>
      ) : null}
    </label>
  );
}

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(control, className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(control, "resize-y", className)} {...props} />;
}

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(control, "cursor-pointer", className)} {...props}>
      {children}
    </select>
  );
}
