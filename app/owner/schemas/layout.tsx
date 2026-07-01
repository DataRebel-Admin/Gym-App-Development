import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requirePermission } from "@/lib/staff";

export default async function SchemasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePermission("schemas:manage");
  const t = await getTranslations("owner.schemas");

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
          {t("title")}
        </h1>
        <nav className="mt-3 flex gap-4 text-sm">
          <Link
            href="/owner/schemas/templates"
            className="text-neutral-500 hover:text-neutral-900"
          >
            {t("navTemplates")}
          </Link>
          <Link
            href="/owner/schemas/members"
            className="text-neutral-500 hover:text-neutral-900"
          >
            {t("navMembers")}
          </Link>
          <Link
            href="/owner/schemas/bulk"
            className="text-neutral-500 hover:text-neutral-900"
          >
            {t("navBulk")}
          </Link>
          <Link
            href="/owner/schemas/insights"
            className="text-neutral-500 hover:text-neutral-900"
          >
            {t("navAnalysis")}
          </Link>
        </nav>
      </div>
      {children}
    </div>
  );
}
