import Link from "next/link";

/**
 * Dashboard-banner die waarschuwt hoeveel machines aandacht nodig hebben.
 * Rendert niets als er niets aan de hand is. Server-compatibel (geen client-JS).
 */
export function MaintenanceAlert({ count }: { count: number }) {
  if (count <= 0) return null;
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
            {count} {count === 1 ? "machine vraagt" : "machines vragen"} om aandacht
          </p>
          <p className="text-sm text-amber-700">
            Bekijk het onderhoudsoverzicht om apparatuur veilig en op tijd te onderhouden.
          </p>
        </div>
      </div>
      <span className="shrink-0 text-sm font-medium text-amber-800">Bekijk →</span>
    </Link>
  );
}
