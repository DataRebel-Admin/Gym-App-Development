import { redirect } from "next/navigation";

export const metadata = { title: "Trainingsschema's" };

export default function SchemasIndex() {
  redirect("/owner/schemas/templates");
}
