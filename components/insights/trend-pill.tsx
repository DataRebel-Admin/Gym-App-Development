import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

/**
 * Trend t.o.v. de voorgaande gelijke periode als pill (idioom ui/stat-card).
 * `null` = geen vorige periode → "nieuw".
 */
export function TrendPill({ pct }: { pct: number | null }) {
  const t = useTranslations("owner.insights");
  if (pct === null) return <span className="text-xs text-neutral-400">{t("new")}</span>;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums",
        pct > 0
          ? "bg-green-500/15 text-green-600"
          : pct < 0
            ? "bg-red-500/15 text-red-600"
            : "bg-neutral-100 text-neutral-500"
      )}
    >
      {pct > 0 ? "▲" : pct < 0 ? "▼" : "—"}
      {Math.abs(pct)}%
    </span>
  );
}
