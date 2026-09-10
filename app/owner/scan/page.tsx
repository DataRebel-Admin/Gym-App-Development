import { forbidden } from "next/navigation";
import { requireTenantUser } from "@/lib/staff";
import { QrScanner } from "@/components/qr-scanner";

export const metadata = { title: "Scannen" };

/**
 * QR-scanner voor de beheerkant: sta je bij een apparaat, dan is de sticker de
 * snelste weg naar de apparaatpagina (met defect-banner en "defect melden").
 * Hergebruikt de scanner van de member-area (`app/member/scan/page.tsx`) — die
 * stuurt door naar de publieke `/m/[qrToken]`, die zowel leden als medewerkers
 * bedient.
 *
 * Toegang: wie iets met apparatuur doet. Geen aparte permissie erbij — dat zou
 * een vijfde vinkje in de rechtenmatrix zijn voor een pagina die niets toont wat
 * die permissies niet al toestaan.
 */
export default async function OwnerScanPage() {
  const user = await requireTenantUser();
  const allowed =
    user.permissions.has("machines:qr-export") ||
    user.permissions.has("maintenance:manage") ||
    user.permissions.has("defects:manage");
  if (!allowed) forbidden();

  return (
    <div className="flex flex-1 flex-col items-center gap-5 px-5 py-8">
      <div className="text-center">
        <h1 className="font-display text-2xl font-bold tracking-tight text-neutral-900">
          Apparaat scannen
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Richt op de QR-sticker van het apparaat.
        </p>
      </div>
      <QrScanner />
    </div>
  );
}
