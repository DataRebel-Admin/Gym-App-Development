import { requireMember } from "@/lib/member";

// Stub — de QR-scanflow wordt in prompt 09 geïmplementeerd.
export default async function ScanPage() {
  await requireMember();
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-4xl">📷</p>
      <p className="text-lg font-medium text-neutral-900">Scan een machine</p>
      <p className="text-sm text-neutral-500">
        De QR-scanner komt eraan (prompt 09).
      </p>
    </div>
  );
}
