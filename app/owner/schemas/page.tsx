import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

export async function generateMetadata() {
  const t = await getTranslations("owner.schemas");
  return { title: t("metaTitle") };
}

export default function SchemasIndex() {
  redirect("/owner/schemas/templates");
}
