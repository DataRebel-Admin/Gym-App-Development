import Link from "next/link";
import { getTranslations } from "next-intl/server";

/**
 * Dashboard-banner die waarschuwt hoeveel machines aandacht nodig hebben.
 * Rendert niets als er niets aan de hand is. Server-compatibel (geen client-JS).
 */
export async function MaintenanceAlert({ count }: { count: number }) {
  if (count <= 0) return null;
  const t = await getTranslations("maintenance");
  return (
    <Link
      href="/owner/maintenance"
      className="flex items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 transition-colors hover:bg-amber-100"
    >
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-xl" aria-hidden>
          🔧
        </span>
        <div>
          <p className="font-semibold text-amber-900">
            {t("alert.attention", { count })}
          </p>
          <p className="text-sm text-amber-700">
            {t("alert.body")}
          </p>
        </div>
      </div>
      <span className="shrink-0 text-sm font-medium text-amber-800">{t("alert.view")}</span>
    </Link>
  );
}
