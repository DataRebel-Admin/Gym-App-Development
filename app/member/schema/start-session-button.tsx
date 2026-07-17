"use client";

import { useFormStatus } from "react-dom";
import { Play } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

function Spinner() {
  return (
    <span
      className="size-5 animate-spin rounded-full border-2 border-current border-t-transparent"
      aria-hidden
    />
  );
}

/**
 * Start-knop met pending-feedback. `startSession` doet twee round-trips
 * (action → redirect → zware active-session-render) zonder tussenscherm; zonder
 * deze feedback lijkt een tik niets te doen en tikt een ongeduldig lid nog eens.
 * `useFormStatus` disablet en toont een spinner zodra de form submit.
 */
export function StartSessionButton({
  label,
  pendingLabel,
  className,
  children,
}: {
  label: string;
  pendingLabel: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={cn(
        "flex w-full items-center gap-2 rounded-2xl bg-accent-gradient font-bold text-accent-foreground shadow-accent transition-transform active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100",
        className
      )}
    >
      {pending ? (
        <span className="flex w-full items-center justify-center gap-2">
          <Spinner /> {pendingLabel}
        </span>
      ) : (
        (children ?? (
          <span className="flex w-full items-center justify-center gap-2 text-lg">
            <Play className="size-5 fill-current" /> {label}
          </span>
        ))
      )}
    </button>
  );
}
