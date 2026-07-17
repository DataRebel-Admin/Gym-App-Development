"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, m } from "motion/react";
import { cn } from "@/lib/cn";

type ToastTone = "success" | "error" | "info";
type Toast = { id: number; message: string; tone: ToastTone };

type ToastApi = {
  toast: (message: string, tone?: ToastTone) => void;
  success: (message: string) => void;
  error: (message: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

const toneStyles: Record<ToastTone, string> = {
  success: "border-green-200 bg-green-50 text-green-800",
  error: "border-red-200 bg-red-50 text-red-800",
  info: "border-border bg-surface-2 text-neutral-900",
};

const toneIcon: Record<ToastTone, string> = {
  success: "✓",
  error: "✕",
  info: "ℹ",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, tone: ToastTone = "info") => {
      const id = counter.current++;
      setToasts((prev) => [...prev, { id, message, tone }]);
      setTimeout(() => remove(id), 4000);
    },
    [remove]
  );

  const api = useMemo<ToastApi>(
    () => ({
      toast,
      success: (m) => toast(m, "success"),
      error: (m) => toast(m, "error"),
    }),
    [toast]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* Screenreaders: fouten onderbreken (assertive), succes/info niet (polite).
          Twee regio's omdat één element maar één live-modus kan dragen. */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {toasts.filter((t) => t.tone !== "error").map((t) => (
          <div key={t.id}>{t.message}</div>
        ))}
      </div>
      <div role="alert" aria-live="assertive" aria-atomic="true" className="sr-only">
        {toasts.filter((t) => t.tone === "error").map((t) => (
          <div key={t.id}>{t.message}</div>
        ))}
      </div>
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4">
        <AnimatePresence>
          {toasts.map((t) => (
            <m.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className={cn(
                "pointer-events-auto flex max-w-sm items-center gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium shadow-lg",
                toneStyles[t.tone]
              )}
            >
              <span aria-hidden className="text-base leading-none">
                {toneIcon[t.tone]}
              </span>
              <span className="flex-1">{t.message}</span>
              <button
                type="button"
                onClick={() => remove(t.id)}
                aria-label="Melding sluiten"
                className="-mr-1 shrink-0 rounded-md px-1.5 text-lg leading-none opacity-60 transition-opacity hover:opacity-100 focus-ring"
              >
                ×
              </button>
            </m.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast moet binnen <ToastProvider> gebruikt worden");
  }
  return ctx;
}
