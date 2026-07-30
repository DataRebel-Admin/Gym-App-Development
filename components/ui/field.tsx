import { cn } from "@/lib/cn";

const controlBase =
  "w-full rounded-xl border border-border bg-surface-1 text-neutral-900 placeholder:text-neutral-400 outline-none transition-shadow focus-ring focus:border-accent disabled:opacity-50";

/**
 * Hoogte-/padding-schaal (spiegelt de knop-maten `h-9`/`h-10` zodat een control
 * naast een knop uitlijnt). De compacte maten zetten de verticale padding **op
 * nul**: `cn` is een simpele concat (geen tailwind-merge), dus een `py-1` op de
 * call-site verliest van de `py-2.5` hieruit — en een vaste `h-8`/`h-9` mét die
 * ruime padding laat een te kleine contentbox over, waardoor de tekst wordt
 * afgeklemd. Een native <select>/<input> centreert z'n tekst zelf in de
 * contentbox, dus `py-0` + vaste hoogte is precies goed.
 */
const controlSizes = {
  xs: "h-8 px-2.5 py-0 text-xs",
  sm: "h-9 px-3 py-0 text-sm",
  md: "px-3.5 py-2.5 text-sm",
} as const;

export type ControlSize = keyof typeof controlSizes;

/** Gedeelde veld-klassen — gebruik dit i.p.v. losse `h-*`/`py-*`-overrides. */
export function controlClasses(size: ControlSize = "md", className?: string) {
  return cn(controlBase, controlSizes[size], className);
}

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

/**
 * `fieldSize` i.p.v. `size` — dat laatste is een bestaand HTML-attribuut op
 * <input>/<select> (tekenbreedte resp. aantal zichtbare regels).
 */
type SizedProps = { fieldSize?: ControlSize };

export function Input({
  className,
  fieldSize,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & SizedProps) {
  return <input className={controlClasses(fieldSize, className)} {...props} />;
}

export function Textarea({
  className,
  fieldSize,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & SizedProps) {
  return (
    <textarea
      className={controlClasses(fieldSize, cn("resize-y", className))}
      {...props}
    />
  );
}

export function Select({
  className,
  fieldSize,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & SizedProps) {
  return (
    <select
      className={controlClasses(fieldSize, cn("cursor-pointer", className))}
      {...props}
    >
      {children}
    </select>
  );
}
