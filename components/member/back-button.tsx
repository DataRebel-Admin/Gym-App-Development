"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "@/components/ui/icons";

/**
 * Terug-knop die de browsergeschiedenis volgt, met fallback-bestemming.
 * Met een expliciete `href` navigeert de knop áltijd daarheen — nodig wanneer
 * de geschiedenis niet klopt met waar de gebruiker heen moet (bijv. een keten
 * alternatieve oefeningen bekeken vanuit de actieve training: "terug" moet dan
 * direct de training zijn, niet de vorige oefening).
 */
export function BackButton({
  fallback = "/member",
  label = "Terug",
  href,
}: {
  fallback?: string;
  label?: string;
  href?: string;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        if (href) router.push(href);
        else if (window.history.length > 1) router.back();
        else router.push(fallback);
      }}
      className="inline-flex items-center gap-1 text-sm text-neutral-500 transition-colors active:text-neutral-900"
    >
      <ChevronLeft className="size-4" /> {label}
    </button>
  );
}
