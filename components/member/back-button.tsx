"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "@/components/ui/icons";

/** Terug-knop die de browsergeschiedenis volgt, met fallback-bestemming. */
export function BackButton({
  fallback = "/member",
  label = "Terug",
}: {
  fallback?: string;
  label?: string;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push(fallback);
      }}
      className="inline-flex items-center gap-1 text-sm text-neutral-500 transition-colors active:text-neutral-900"
    >
      <ChevronLeft className="size-4" /> {label}
    </button>
  );
}
