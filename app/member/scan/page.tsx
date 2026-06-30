import { requireMember } from "@/lib/member";
import { QrScanner } from "@/components/qr-scanner";

export const metadata = { title: "Scannen" };

export default async function ScanPage() {
  await requireMember();

  return (
    <div className="flex flex-1 flex-col items-center gap-5 px-5 py-8">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
        Scan machine
      </h1>
      <QrScanner />
    </div>
  );
}
