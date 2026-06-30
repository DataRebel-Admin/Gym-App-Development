import { getTranslations } from "next-intl/server";
import { requireMember } from "@/lib/member";
import { QrScanner } from "@/components/qr-scanner";

export async function generateMetadata() {
  const t = await getTranslations("member.scan");
  return { title: t("metaTitle") };
}

export default async function ScanPage() {
  await requireMember();
  const t = await getTranslations("member.scan");

  return (
    <div className="flex flex-1 flex-col items-center gap-5 px-5 py-8">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
        {t("title")}
      </h1>
      <QrScanner />
    </div>
  );
}
